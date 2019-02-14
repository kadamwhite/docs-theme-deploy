const {
	camelCaseDash,
	filePath,
	withOverrides,
} = require( './helpers' );

describe( 'helpers', () => {

	describe( 'camelCaseDash', () => {
		it( 'is a function', () => {
			expect( camelCaseDash ).toBeInstanceOf( Function );
		} );

		it( 'transforms kebab-case strings to camel-case', () => {
			expect( camelCaseDash( 'kebab-case' ) ).toBe( 'kebabCase' );
			expect( camelCaseDash( 'dash-delimited-string' ) ).toBe( 'dashDelimitedString' );
		} );

		it( 'does not modify non-dash-delimited strings', () => {
			expect( camelCaseDash( 'word' ) ).toBe( 'word' );
			expect( camelCaseDash( 'camelCase' ) ).toBe( 'camelCase' );
			expect( camelCaseDash( 'UpperCamelCase' ) ).toBe( 'UpperCamelCase' );
		} );
	} );

	describe( 'withOverrides', () => {
		it( 'is a function', () => {
			expect( withOverrides ).toBeInstanceOf( Function );
		} );

		it( 'returns a function', () => {
			expect( withOverrides() ).toBeInstanceOf( Function );
		} );

		it( 'returns a function which returns an object', () => {
			expect( withOverrides()() ).toEqual( {} );
		} );

		it( 'generates an object based on a provided template', () => {
			const template = {
				test: /\.jsx?$/,
				exclude: /node_modules/,
				options: {
					cacheDirectory: true,
				},
			};
			const output = withOverrides( template )();
			expect( output ).toEqual( template );
			expect( output ).not.toBe( template );
		} );
	} );

	describe( 'filePath', () => {
		it( 'properly generates a file system theme file path', () => {
			expect( filePath() ).toBe( process.cwd() );
			expect( filePath( 'themes/theme-name' ) ).toBe( `${ process.cwd() }/themes/theme-name` );
			expect( filePath( 'themes', 'theme-name', 'style.css' ) ).toBe( `${ process.cwd() }/themes/theme-name/style.css` );
		} );
	} );

} );
