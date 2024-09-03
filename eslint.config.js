const globals = require("globals")

module.exports = [
  { languageOptions: { globals: globals.node } },
  {
    // Check only *.ts files in the src directory
    files: ["*.ts"],
    // Ignore all files in node_modules and dist directories
    ignores: ["node_modules/**/*.ts", "dist/**/*.ts"],
  },
  {
    rules: {
      quotes: ["error", "double", { allowTemplateLiterals: true }],
    },
  },
]
