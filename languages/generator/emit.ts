import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { captureNames } from './captures.ts';
import { hasScanner } from './grammar.ts';
import { type GrammarEntry, type LanguageEntry, pascal } from './manifest.ts';
import type { QueryKind } from './queries.ts';

export type GrammarQueries = Record<QueryKind, string | null>;
export type EmitContext = {
  entry: LanguageEntry;
  version: string;
  outDir: string;
  grammarDir: string;
  queries: Record<string, GrammarQueries>;
  grammarLicense: string | null;
  nvimRev: string;
};

const KOTLIN_CHUNK = 60_000;

export function jniName(pkg: string, cls: string, method: string): string {
  const mangle = (s: string) => s.replace(/_/g, '_1');
  return `Java_${pkg.split('.').map(mangle).join('_')}_${mangle(cls)}_${mangle(method)}`;
}

// Replacer functions, because "$'" inside a replacement string means "the text after the match".
const DOLLAR = () => "${'$'}";
const TRIPLE_QUOTE = () => `""\${'"'}`;

function kotlinRaw(text: string): string {
  return `"""${text.replace(/\$/g, DOLLAR).replace(/"""/g, TRIPLE_QUOTE)}"""`;
}

/** Kotlin raw string, chunked so no single constant exceeds the 65535 byte class file limit. */
export function kotlinStringLiteral(text: string): string {
  if (text.length <= KOTLIN_CHUNK) return kotlinRaw(text);
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += KOTLIN_CHUNK) {
    parts.push(`  ${kotlinRaw(text.slice(i, i + KOTLIN_CHUNK))},`);
  }
  return `listOf(\n${parts.join('\n')}\n).joinToString("")`;
}

export function swiftRawString(text: string): string {
  if (text.includes('"""#')) throw new Error('query text contains the raw string terminator');
  return `#"""\n${text}\n"""#`;
}

const kotlinPackage = (g: GrammarEntry) => `me.sectiontn.codepad.lang.${g.name}`;
const kotlinClass = (g: GrammarEntry) => `${pascal(g.name)}Language`;
const packageName = (id: string) => `react-native-codepad-lang-${id}`;
const podName = (id: string) => `CodepadLang${pascal(id)}`;
const libName = (id: string) => `codepad_lang_${id}`;

function write(root: string, rel: string, text: string): void {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
}

export function cmake(ctx: EmitContext): string {
  const { entry, grammarDir } = ctx;
  const sources = entry.grammars.flatMap((g) => [
    `  \${GRAMMAR}/${g.src}/parser.c`,
    ...(hasScanner(grammarDir, g.src) ? [`  \${GRAMMAR}/${g.src}/scanner.c`] : []),
  ]);
  // A scanner may include tree_sitter/parser.h from a sibling dir (typescript/common), so each src dir is an include path.
  const includes = entry.grammars.map(
    (g) => `target_include_directories(${libName(entry.id)} PRIVATE \${GRAMMAR}/${g.src})`,
  );
  const parserProps = entry.grammars.map(
    (g) =>
      `set_source_files_properties(\${GRAMMAR}/${g.src}/parser.c PROPERTIES COMPILE_OPTIONS "-O1")`,
  );
  return `cmake_minimum_required(VERSION 3.13)
project(${libName(entry.id)} C)
set(GRAMMAR \${CMAKE_SOURCE_DIR}/../grammar)

add_library(${libName(entry.id)} SHARED
  src/main/cpp/lang.c
${sources.join('\n')}
)

${includes.join('\n')}

# Parser tables are data. -O1 keeps large grammars from taking minutes to compile.
${parserProps.join('\n')}
target_compile_options(${libName(entry.id)} PRIVATE -std=c11 -O2 -fvisibility=hidden -w)
`;
}

function langC(ctx: EmitContext): string {
  const decls = ctx.entry.grammars.map((g) => `const void *tree_sitter_${g.name}(void);`);
  const fns = ctx.entry.grammars.map(
    (
      g,
    ) => `JNIEXPORT jlong JNICALL ${jniName(kotlinPackage(g), kotlinClass(g), 'nativeLanguage')}(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_${g.name}();
}`,
  );
  return `#include <jni.h>
#include <stdint.h>

${decls.join('\n')}

${fns.join('\n\n')}
`;
}

function buildGradle(ctx: EmitContext): string {
  return `buildscript {
  repositories {
    google()
    mavenCentral()
  }
  dependencies {
    classpath "com.android.tools.build:gradle:8.7.2"
    classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21"
  }
}

apply plugin: "com.android.library"
if (project.extensions.findByName("kotlin") == null) {
  apply plugin: "kotlin-android"
}
apply plugin: "com.facebook.react"

def safeExtGet(prop, fallback) {
  rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

def reactNativeArchitectures() {
  def value = rootProject.getProperties().get("reactNativeArchitectures")
  return value ? value.split(",") : ["armeabi-v7a", "x86", "x86_64", "arm64-v8a"]
}

android {
  namespace "me.sectiontn.codepad.lang.${ctx.entry.id}"
  compileSdkVersion safeExtGet("compileSdkVersion", 36)

  defaultConfig {
    minSdkVersion safeExtGet("minSdkVersion", 24)
    consumerProguardFiles "consumer-rules.pro"
    externalNativeBuild {
      cmake {
        arguments "-DANDROID_STL=none", "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
        abiFilters(*reactNativeArchitectures())
      }
    }
  }

  if (rootProject.ext.has("ndkVersion")) {
    ndkVersion rootProject.ext.ndkVersion
  }

  externalNativeBuild {
    cmake {
      path "CMakeLists.txt"
    }
  }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
  }
}

dependencies {
  implementation "com.facebook.react:react-android"
  implementation project(":react-native-codepad")
}
`;
}

function kotlinLanguage(g: GrammarEntry, q: GrammarQueries): string {
  return `package ${kotlinPackage(g)}

import me.sectiontn.codepad.syntax.LanguageProvider

class ${kotlinClass(g)} : LanguageProvider {
  override val id: String = "${g.name}"
  override val languagePointer: Long get() = nativeLanguage()
  override val highlights: String = HIGHLIGHTS
  override val injections: String = INJECTIONS

  private external fun nativeLanguage(): Long

  companion object {
    init {
      System.loadLibrary("${libName(g.name.split('_')[0]!)}")
    }

    private val HIGHLIGHTS: String = ${kotlinStringLiteral(q.highlights ?? '')}
    private val INJECTIONS: String = ${kotlinStringLiteral(q.injections ?? '')}
  }
}
`;
}

function kotlinPackageClass(ctx: EmitContext): string {
  const cls = `CodepadLang${pascal(ctx.entry.id)}Package`;
  return `package me.sectiontn.codepad.lang.${ctx.entry.id}

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

// Empty package so React Native autolinking includes this Gradle module.
class ${cls} : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { HashMap() }
}
`;
}

function swiftLanguage(g: GrammarEntry, q: GrammarQueries): string {
  const cls = `CPLang${pascal(g.name)}`;
  return `import Foundation
import Codepad

@objc(${cls})
public final class ${cls}: NSObject, CPLanguageProvider {
  public let id: String = "${g.name}"
  public var languagePointer: UnsafeRawPointer { UnsafeRawPointer(tree_sitter_${g.name}()) }
  public let highlights: String = ${swiftRawString(q.highlights ?? '')}
  public let injections: String = ${swiftRawString(q.injections ?? '')}
}
`;
}

function swiftHeader(g: GrammarEntry): string {
  return `#import <Foundation/Foundation.h>

#ifdef __cplusplus
extern "C" {
#endif

const void *tree_sitter_${g.name}(void);

#ifdef __cplusplus
}
#endif
`;
}

function podspec(ctx: EmitContext): string {
  const { entry, grammarDir } = ctx;
  const sources = entry.grammars.flatMap((g) => [
    `"grammar/${g.src}/parser.c"`,
    ...(hasScanner(grammarDir, g.src) ? [`"grammar/${g.src}/scanner.c"`] : []),
  ]);
  const headerPaths = entry.grammars
    .map((g) => `\\"$(PODS_TARGET_SRCROOT)/grammar/${g.src}\\"`)
    .join(' ');
  return `require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "${podName(entry.id)}"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/SectionTN/react-native-codepad.git", :tag => "v#{s.version}" }

  s.source_files = ["ios/*.{h,swift}", ${sources.join(', ')}]
  s.public_header_files = "ios/*.h"
  s.preserve_paths = "grammar/**/*"
  s.compiler_flags = "-w"
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "${headerPaths}",
    "GCC_OPTIMIZATION_LEVEL" => "1",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "SWIFT_OBJC_INTEROP_MODE" => "objcxx",
    "DEFINES_MODULE" => "YES",
  }

  s.dependency "Codepad"
end
`;
}

function packageJson(ctx: EmitContext): string {
  const { entry, version } = ctx;
  return `${JSON.stringify(
    {
      name: packageName(entry.id),
      version,
      description: `tree-sitter ${pascal(entry.id)} grammar and highlight queries for react-native-codepad`,
      main: './src/index.ts',
      types: './src/index.ts',
      files: [
        'src',
        'android',
        'ios',
        'grammar',
        'queries',
        '*.podspec',
        '!android/build',
        '!android/.cxx',
      ],
      keywords: ['react-native', 'codepad', 'tree-sitter', entry.id],
      repository: {
        type: 'git',
        url: 'git+https://github.com/SectionTN/react-native-codepad.git',
        directory: `languages/${entry.id}`,
      },
      author: 'Rayen Sbai <rayensbai2@gmail.com> (https://github.com/SectionTN)',
      license: 'MIT',
      homepage: 'https://github.com/SectionTN/react-native-codepad#readme',
      peerDependencies: { 'react-native-codepad': version },
      publishConfig: { registry: 'https://registry.npmjs.org/' },
      codepad: {
        generated: true,
        grammar: `${entry.repo}@${entry.rev}`,
        queries: `nvim-treesitter/nvim-treesitter@${ctx.nvimRev}`,
      },
    },
    null,
    2,
  )}\n`;
}

function readme(ctx: EmitContext): string {
  const { entry } = ctx;
  const sections = entry.grammars.map((g) => {
    const names = captureNames(ctx.queries[g.name]?.highlights ?? '');
    return `### ${g.name}\n\n${names.map((n) => `- \`${n}\``).join('\n')}`;
  });
  return `# ${packageName(entry.id)}

Generated package. Do not edit by hand; run \`yarn gen:languages\` in the react-native-codepad repository.

Grammar: ${entry.repo} at ${entry.rev}. Queries: nvim-treesitter at ${ctx.nvimRev}.

## Install

\`\`\`sh
yarn add react-native-codepad ${packageName(entry.id)}
\`\`\`

Then pass \`language="${entry.grammars[0]!.name}"\` to \`CodeEditor\`. Theme token keys this package produces:

${sections.join('\n\n')}

See the [languages guide](https://sectiontn.github.io/react-native-codepad/guides/languages/) for aliases, injections and themes.
`;
}

function notices(ctx: EmitContext): string {
  const grammar = ctx.grammarLicense
    ? `## Grammar (${ctx.entry.repo})\n\n${ctx.grammarLicense}`
    : `## Grammar (${ctx.entry.repo})\n\nSee the upstream repository for its license.`;
  return `# Third party notices

${grammar}

## Queries (nvim-treesitter/nvim-treesitter)

Copyright nvim-treesitter contributors. Licensed under the Apache License, Version 2.0. Query files under queries/ were resolved from the upstream files at ${ctx.nvimRev} and had predicates rewritten by the generator.
`;
}

export function emitPackage(ctx: EmitContext): void {
  const { entry, outDir } = ctx;
  write(outDir, 'package.json', packageJson(ctx));
  write(outDir, 'README.md', readme(ctx));
  write(outDir, 'THIRD_PARTY_NOTICES.md', notices(ctx));
  write(outDir, `${podName(entry.id)}.podspec`, podspec(ctx));
  write(
    outDir,
    'src/index.ts',
    `${entry.grammars.map((g) => `export const ${g.name} = '${g.name}' as const;`).join('\n')}\n`,
  );
  write(outDir, 'android/build.gradle', buildGradle(ctx));
  write(outDir, 'android/CMakeLists.txt', cmake(ctx));
  write(
    outDir,
    'android/consumer-rules.pro',
    entry.grammars
      .map((g) => `-keep class ${kotlinPackage(g)}.${kotlinClass(g)} { *; }`)
      .join('\n'),
  );
  write(
    outDir,
    'android/src/main/AndroidManifest.xml',
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n</manifest>',
  );
  write(outDir, 'android/src/main/cpp/lang.c', langC(ctx));
  write(
    outDir,
    `android/src/main/java/me/sectiontn/codepad/lang/${entry.id}/CodepadLang${pascal(entry.id)}Package.kt`,
    kotlinPackageClass(ctx),
  );
  for (const g of entry.grammars) {
    const q = ctx.queries[g.name]!;
    const kotlinDir = `android/src/main/java/${kotlinPackage(g).replace(/\./g, '/')}`;
    write(outDir, `${kotlinDir}/${kotlinClass(g)}.kt`, kotlinLanguage(g, q));
    write(outDir, `android/src/main/assets/codepad-languages/${g.name}`, ctx.version);
    write(outDir, `ios/CPLang${pascal(g.name)}.h`, swiftHeader(g));
    write(outDir, `ios/CPLang${pascal(g.name)}.swift`, swiftLanguage(g, q));
    for (const kind of ['highlights', 'injections', 'locals', 'indents'] as const) {
      const text = q[kind];
      if (text != null) write(outDir, `queries/${g.name}/${kind}.scm`, text);
    }
  }
}
