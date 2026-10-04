// Autolinking derives the import path from the Gradle namespace (me.sectiontn.codepad),
// but nitrogen forces the Package class into com.margelo.nitro.codepad.
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.margelo.nitro.codepad.CodepadPackage;',
      },
    },
  },
};
