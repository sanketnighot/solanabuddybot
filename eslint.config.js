const globals = require("globals")
const pluginJs = require("@eslint/js")

module.exports = [
  { languageOptions: { globals: globals.node } },
  { files: ["*.js"] },
  { ignores: ["./node_modules/**/*", "./dist/**/*"] },
  {
    rules: {
      "no-console": "error",
      quotes: ["error", "double", { allowTemplateLiterals: true }],
    },
  },
  pluginJs.configs.recommended,
]
