package me.sectiontn.codepad.lang.java

import me.sectiontn.codepad.syntax.LanguageProvider

class JavaLanguage : LanguageProvider {
  override val id: String = "java"
  override val languagePointer: Long get() = nativeLanguage()
  override val highlights: String = HIGHLIGHTS
  override val injections: String = INJECTIONS

  private external fun nativeLanguage(): Long

  companion object {
    init {
      System.loadLibrary("codepad_lang_java")
    }

    private val HIGHLIGHTS: String = """; CREDITS @maxbrunsfeld (maxbrunsfeld@gmail.com)
; Variables
(identifier) @variable

(underscore_pattern) @character.special

; Methods
(method_declaration
  name: (identifier) @function.method)

(method_invocation
  name: (identifier) @function.method.call)

(super) @function.builtin

; Parameters
(formal_parameter
  name: (identifier) @variable.parameter)

(spread_parameter
  (variable_declarator
    name: (identifier) @variable.parameter)) ; int... foo

; Lambda parameter
(inferred_parameters
  (identifier) @variable.parameter) ; (x,y) -> ...

(lambda_expression
  parameters: (identifier) @variable.parameter) ; x -> ...

; Operators
[
  "+"
  ":"
  "++"
  "-"
  "--"
  "&"
  "&&"
  "|"
  "||"
  "!"
  "!="
  "=="
  "*"
  "/"
  "%"
  "<"
  "<="
  ">"
  ">="
  "="
  "-="
  "+="
  "*="
  "/="
  "%="
  "->"
  "^"
  "^="
  "&="
  "|="
  "~"
  ">>"
  ">>>"
  "<<"
  "::"
] @operator

; Types
(interface_declaration
  name: (identifier) @type)

(annotation_type_declaration
  name: (identifier) @type)

(class_declaration
  name: (identifier) @type)

(record_declaration
  name: (identifier) @type)

(enum_declaration
  name: (identifier) @type)

(constructor_declaration
  name: (identifier) @type)

(compact_constructor_declaration
  name: (identifier) @type)

(type_identifier) @type

((type_identifier) @type.builtin
  (#eq? @type.builtin "var"))

((method_invocation
  object: (identifier) @type)
  (#match? @type "^[A-Z]"))

((method_reference
  .
  (identifier) @type)
  (#match? @type "^[A-Z]"))

((field_access
  object: (identifier) @type)
  (#match? @type "^[A-Z]"))

(scoped_identifier
  (identifier) @type
  (#match? @type "^[A-Z]"))

; Fields
(field_declaration
  declarator: (variable_declarator
    name: (identifier) @variable.member))

(field_access
  field: (identifier) @variable.member)

[
  (boolean_type)
  (integral_type)
  (floating_point_type)
  (void_type)
] @type.builtin

; Variables
((identifier) @constant
  (#match? @constant "^[A-Z_][A-Z0-9_]+${'$'}"))

(this) @variable.builtin

; Annotations
(annotation
  "@" @attribute
  name: (identifier) @attribute)

(marker_annotation
  "@" @attribute
  name: (identifier) @attribute)

; Literals
(string_literal) @string

(escape_sequence) @string.escape

(character_literal) @character

[
  (hex_integer_literal)
  (decimal_integer_literal)
  (octal_integer_literal)
  (binary_integer_literal)
] @number

[
  (decimal_floating_point_literal)
  (hex_floating_point_literal)
] @number.float

[
  (true)
  (false)
] @boolean

(null_literal) @constant.builtin

; Keywords
[
  "assert"
  "default"
  "extends"
  "implements"
  "instanceof"
  "@interface"
  "permits"
  "to"
  "with"
] @keyword

[
  "record"
  "class"
  "enum"
  "interface"
] @keyword.type

(synchronized_statement
  "synchronized" @keyword)

[
  "abstract"
  "final"
  "native"
  "non-sealed"
  "open"
  "private"
  "protected"
  "public"
  "sealed"
  "static"
  "strictfp"
  "transitive"
] @keyword.modifier

(modifiers
  "synchronized" @keyword.modifier)

[
  "transient"
  "volatile"
] @keyword.modifier

[
  "return"
  "yield"
] @keyword.return

"new" @keyword.operator

; Conditionals
[
  "if"
  "else"
  "switch"
  "case"
  "when"
] @keyword.conditional

(ternary_expression
  [
    "?"
    ":"
  ] @keyword.conditional.ternary)

(wildcard
  "?" @character.special)

; Loops
[
  "for"
  "while"
  "do"
  "continue"
  "break"
] @keyword.repeat

; Includes
[
  "exports"
  "import"
  "module"
  "opens"
  "package"
  "provides"
  "requires"
  "uses"
] @keyword.import

(import_declaration
  (asterisk
    "*" @character.special))

; Punctuation
[
  ";"
  "."
  "..."
  ","
] @punctuation.delimiter

[
  "{"
  "}"
] @punctuation.bracket

[
  "["
  "]"
] @punctuation.bracket

[
  "("
  ")"
] @punctuation.bracket

(type_arguments
  [
    "<"
    ">"
  ] @punctuation.bracket)

(type_parameters
  [
    "<"
    ">"
  ] @punctuation.bracket)

(string_interpolation
  [
    "\\{"
    "}"
  ] @punctuation.special)

; Exceptions
[
  "throw"
  "throws"
  "finally"
  "try"
  "catch"
] @keyword.exception

; Labels
(labeled_statement
  (identifier) @label)

; Comments
[
  (line_comment)
  (block_comment)
] @comment @spell

((block_comment) @comment.documentation
  (#match? @comment.documentation "^/[*][*][^*].*[*]/${'$'}"))

((line_comment) @comment.documentation
  (#match? @comment.documentation "^///[^/]"))

((line_comment) @comment.documentation
  (#match? @comment.documentation "^///${'$'}"))
"""
    private val INJECTIONS: String = """([
  (block_comment)
  (line_comment)
] @injection.content
  (#set! injection.language "comment"))

((block_comment) @injection.content
  (#match? @injection.content "/[*][*][\\s]")
  (#set! injection.language "javadoc"))

; markdown-style javadocs https://openjdk.org/jeps/467
((line_comment) @injection.content
  (#match? @injection.content "^///\\s")
  (#set! injection.language "javadoc"))

((method_invocation
  name: (identifier) @_method
  arguments: (argument_list
    .
    (string_literal
      .
      (_) @injection.content)))
  (#any-of? @_method "format" "printf")
  (#set! injection.language "printf"))

((method_invocation
  object: (string_literal
    (string_fragment) @injection.content)
  name: (identifier) @_method)
  (#eq? @_method "formatted")
  (#set! injection.language "printf"))
"""
  }
}
