/* eslint-disable sort-keys */

module.exports = {
	root: true,
	extends: ['moon', 'moon/node'],
	parserOptions: {
		project: 'tsconfig.json',
		tsconfigRootDir: __dirname,
	},
};
