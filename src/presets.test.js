const {
	development,
	production,
} = require( './presets' );
const plugins = require( './plugins' );

jest.mock( 'process', () => ( { cwd: () => 'cwd' } ) );

/**
 * Filter an array of plugins to only contain plugins of the provided type.
 *
 * @param {Function} Constructor Plugin constructor.
 * @returns {Function} Function of type ( plugin ) => boolean.
 */
const filterPlugins = ( Constructor ) => ( plugin ) => plugin instanceof Constructor;

/**
 * Find a loader of a given type within a module.rules configuration.
 *
 * @param {Object[]} rules      Webpack configuration module.rules array.
 * @param {String}   loaderType Package name of the loader to search for.
 * @returns {Object|null} A matched loader definition, or null.
 */
const getLoaderByName = ( rules, loaderType ) => {
	for ( let rule of rules ) {
		if ( rule.loader && rule.loader.indexOf( loaderType ) > -1 ) {
			return rule;
		}
		if ( rule.oneOf ) {
			const nestedMatch = getLoaderByName( rule.oneOf, loaderType );
			if ( nestedMatch ) {
				return nestedMatch;
			}
		}
	}
	return null;
};

/**
 * Find a loader matching a given regular expression within a module.rules configuration.
 *
 * @param {Object[]}      rules      Webpack configuration module.rules array.
 * @param {String|RegExp} loaderTest Test property of the loader to search for.
 * @returns {Object|null} A matched loader definition, or null.
 */
const getLoaderByTest = ( rules, loaderTest ) => {
	for ( let rule of rules ) {
		// console.log( rule.test );
		// /re/ === /re/ is false; /re/.toString() === /re/.toString() is true.
		if ( rule.test && rule.test.toString() === loaderTest.toString() ) {
			return rule;
		}
		if ( rule.oneOf ) {
			const nestedMatch = getLoaderByTest( rule.oneOf, loaderTest );
			if ( nestedMatch ) {
				return nestedMatch;
			}
		}
	}
	return null;
};

describe( 'presets', () => {
	describe( 'development()', () => {
		it( 'is a function', () => {
			expect( development ).toBeInstanceOf( Function );
		} );

		it( 'merges provided options with defaults to return a full webpack config object', () => {
			const config = development( {
				entry: 'some-file.js',
				output: {
					path: 'build/',
				},
			} );
			expect( config.entry ).toEqual( 'some-file.js' );
			expect( config.output ).toEqual( {
				pathinfo: true,
				filename: '[name].js',
				chunkFilename: '[name].[contenthash].chunk.js',
				path: 'build/',
			} );
		} );

		it( 'supplies a default entry if none is provided', () => {
			const config = development();
			expect( config.entry ).toHaveProperty( 'index' );
			expect( config.entry.index ).toMatchFilePath( 'cwd/src/index.js' );
		} );

		it( 'uses a provided entry object without alteration', () => {
			const config = development( {
				entry: {
					main: 'some-file.js',
				},
			} );
			expect( config.entry ).toEqual( {
				main: 'some-file.js',
			} );
		} );

		it( 'assumes a default output.publicPath if a port is specified', () => {
			const config = development( {
				devServer: {
					port: 9090,
				},
				entry: 'some-file.js',
			} );
			expect( config.output.publicPath ).toBe( 'http://localhost:9090/build/' );
		} );

		it( 'accounts for the value of devServer.https when inferring publicPath URI', () => {
			const config = development( {
				devServer: {
					https: true,
					port: 9090,
				},
				entry: 'some-file.js',
			} );
			expect( config.output.publicPath ).toBe( 'https://localhost:9090/build/' );
		} );

		it( 'adapts output.path when inferring publicPath URI', () => {
			const config = development( {
				devServer: {
					port: 9090,
				},
				entry: 'some-file.js',
				output: {
					path: 'some/target',
				},
			} );
			expect( config.output.publicPath ).toBe( 'http://localhost:9090/some/target/' );
		} );

		it( 'does not assume output.publicPath if a port is not specified', () => {
			const config = development( {
				entry: 'some-file.js',
			} );
			expect( config.output.publicPath ).toBeUndefined();
		} );

		it( 'does not overwrite an existing output.publicPath when present', () => {
			const config = development( {
				entry: 'some-file.js',
				output: {
					publicPath: 'https://my-custom-domain.local/',
				},
			} );
			expect( config.output.publicPath ).toBe( 'https://my-custom-domain.local/' );
		} );

		it( 'injects a ManifestPlugin if publicPath can be inferred and no manifest plugin is already present', () => {
			const { ManifestPlugin } = plugins.constructors;
			const config = development( {
				devServer: {
					port: 8080
				},
				entry: {
					main: 'some-file.css',
				},
			} );
			expect( config.plugins ).toEqual( expect.arrayContaining( [
				expect.any( plugins.constructors.ManifestPlugin ),
			] ) );
			const manifestPlugins = config.plugins.filter( filterPlugins( ManifestPlugin ) );
			expect( manifestPlugins.length ).toBe( 1 );
			expect( manifestPlugins[ 0 ].options.fileName ).toEqual( 'asset-manifest.json' );
		} );

		it( 'does not inject a ManifestPlugin if publicPath cannot be inferred', () => {
			const config = development( {
				entry: {
					main: 'some-file.css',
				},
			} );
			expect( config.output ).not.toHaveProperty( 'publicPath' );
			expect( config.plugins ).toEqual( expect.not.arrayContaining( [
				expect.any( plugins.constructors.ManifestPlugin ),
			] ) );
		} );

		it( 'does not override or duplicate existing ManifestPlugin instances', () => {
			const { ManifestPlugin } = plugins.constructors;
			const config = development( {
				entry: {
					main: 'some-file.css',
				},
				devServer: {
					port: 8080
				},
				plugins: [
					plugins.manifest( {
						fileName: 'custom-manifest.json',
					} ),
				],
			} );
			expect( config.plugins ).toEqual( expect.arrayContaining( [
				expect.any( plugins.constructors.ManifestPlugin ),
			] ) );
			const manifestPlugins = config.plugins.filter( filterPlugins( ManifestPlugin ) );
			expect( manifestPlugins.length ).toBe( 1 );
			expect( manifestPlugins[ 0 ].options.fileName ).toEqual( 'custom-manifest.json' );
		} );

		it( 'uses a consistent seed for manifests generated in the same directory', () => {
			const { ManifestPlugin } = plugins.constructors;
			const [ manifest1 ] = development( {
				entry: { main: 'some-file' },
				output: {
					path: '/some/path',
				},
				devServer: {
					port: 8080,
				},
			} )
				.plugins
				.filter( filterPlugins( ManifestPlugin ) );
			const [ manifest2 ] = development( {
				entry: { main: 'some-file' },
				output: {
					path: '/some/path',
				},
				devServer: {
					port: 8080,
				},
			} )
				.plugins
				.filter( filterPlugins( ManifestPlugin ) );
			const [ manifest3 ] = development( {
				entry: { main: 'some-file' },
				output: {
					path: '/some/DIFFERENT/path',
				},
				devServer: {
					port: 8080,
				},
			} )
				.plugins
				.filter( filterPlugins( ManifestPlugin ) );
			// Ensure the two builds in the same folder use the same seed.
			expect( manifest1.options.seed ).toEqual( {} );
			expect( manifest2.options.seed ).toEqual( {} );
			expect( manifest1 ).not.toBe( manifest2 );
			expect( manifest1.options.seed ).toBe( manifest2.options.seed );
			// Ensure the build to the other output.path uses a different seed.
			expect( manifest3 ).not.toBe( manifest1 );
			expect( manifest3 ).not.toBe( manifest2 );
			expect( manifest3.options.seed ).toEqual( {} );
			expect( manifest3.options.seed ).not.toBe( manifest2.options.seed );
			expect( manifest3.options.seed ).not.toBe( manifest1.options.seed );
		} );

		it( 'permits filtering the computed output of individual loaders', () => {
			const config = development( {
				entry: {
					main: 'some-file.js',
				},
			}, {
				filterLoaders: ( loader, loaderType ) => {
					if ( loaderType === 'file' ) {
						loader.options.publicPath = '../../';
					}
					if ( loaderType === 'url' ) {
						loader.test = /\.(png|jpg|jpeg|gif|svg)$/;
					}
					return loader;
				},
			} );
			const fileLoader = getLoaderByName( config.module.rules, 'file-loader' );
			const urlLoader = getLoaderByName( config.module.rules, 'url-loader' );
			const jsLoader = getLoaderByName( config.module.rules, 'babel-loader' );
			expect( fileLoader ).toEqual( expect.objectContaining( {
				exclude: /\.(js|html|json)$/,
				options: {
					publicPath: '../../',
				},
			} ) );
			expect( urlLoader ).toEqual( expect.objectContaining( {
				test: /\.(png|jpg|jpeg|gif|svg)$/,
				options: {
					limit: 10000,
				},
			} ) );
			expect( jsLoader ).not.toBeNull();
		} );

		it( 'permits filtering the entire stylesheet loader chain', () => {
			const config = development( {
				entry: {
					main: 'some-file.js',
				},
			}, {
				filterLoaders: ( loader, loaderType ) => {
					if ( loaderType === 'stylesheet' ) {
						loader.test = /\.styl$/;
					}
					if ( loaderType === 'sass' ) {
						return {
							loader: 'stylus',
							mode: 'development',
						};
					}
					return loader;
				},
			} );
			const styleChain = getLoaderByTest( config.module.rules, /\.styl$/ );
			expect( styleChain ).toEqual( {
				test: /\.styl$/,
				use: expect.arrayContaining( [
					{
						loader: 'stylus',
						mode: 'development',
					},
				] ),
			} );
			const sassLoader = getLoaderByTest( config.module.rules, /\.s?css$/ );
			expect( sassLoader ).toBeNull();
		} );
	} );

	describe( 'production()', () => {
		it( 'is a function', () => {
			expect( production ).toBeInstanceOf( Function );
		} );

		it( 'merges provided options with defaults to return a full webpack config object', () => {
			const config = production( {
				entry: 'some-file.js',
				output: {
					path: 'build/',
				},
			} );
			expect( config.entry ).toEqual( 'some-file.js' );
			expect( config.output ).toEqual( {
				pathinfo: false,
				filename: '[name].js',
				chunkFilename: '[name].[contenthash].chunk.js',
				path: 'build/',
			} );
		} );

		it( 'supplies a default entry if none is provided', () => {
			const config = production();
			expect( config.entry ).toHaveProperty( 'index' );
			expect( config.entry.index ).toMatchFilePath( 'cwd/src/index.js' );
		} );

		it( 'uses a provided entry object without alteration', () => {
			const config = production( {
				entry: {
					main: 'some-file.js',
				},
			} );
			expect( config.entry ).toEqual( {
				main: 'some-file.js',
			} );
		} );

		it( 'injects a MiniCssExtractPlugin if none is present in options', () => {
			const { MiniCssExtractPlugin } = plugins.constructors;
			const config = production( {
				entry: {
					main: 'some-file.css',
				},
			} );
			expect( config.plugins ).toEqual( expect.arrayContaining( [
				expect.any( plugins.constructors.MiniCssExtractPlugin ),
			] ) );
			const cssPlugins = config.plugins.filter( filterPlugins( MiniCssExtractPlugin ) );
			expect( cssPlugins.length ).toBe( 1 );
			expect( cssPlugins[ 0 ].options.filename ).toEqual( '[name].[contenthash].css' );
		} );

		it( 'does not override or duplicate existing MiniCssExtractPlugin instances', () => {
			const { MiniCssExtractPlugin } = plugins.constructors;
			const config = production( {
				entry: {
					main: 'some-file.css',
				},
				plugins: [
					plugins.miniCssExtract( {
						filename: 'custom-filename.css',
					} ),
				],
			} );
			expect( config.plugins ).toEqual( expect.arrayContaining( [
				expect.any( MiniCssExtractPlugin ),
			] ) );
			const cssPlugins = config.plugins.filter( filterPlugins( MiniCssExtractPlugin ) );
			expect( cssPlugins.length ).toBe( 1 );
			expect( cssPlugins[ 0 ].options.filename ).toEqual( 'custom-filename.css' );
		} );

		it( 'injects a production ManifestPlugin if none is present in options', () => {
			const { ManifestPlugin } = plugins.constructors;
			const config = production( {
				entry: {
					main: 'some-file.css',
				},
			} );
			expect( config.plugins ).toEqual( expect.arrayContaining( [
				expect.any( plugins.constructors.ManifestPlugin ),
			] ) );
			const manifestPlugins = config.plugins.filter( filterPlugins( ManifestPlugin ) );
			expect( manifestPlugins.length ).toBe( 1 );
			expect( manifestPlugins[ 0 ].options.fileName ).toEqual( 'production-asset-manifest.json' );
		} );

		it( 'does not override or duplicate existing ManifestPlugin instances', () => {
			const { ManifestPlugin } = plugins.constructors;
			const config = production( {
				entry: {
					main: 'some-file.css',
				},
				plugins: [
					plugins.manifest( {
						fileName: 'custom-manifest.json',
					} ),
				],
			} );
			expect( config.plugins ).toEqual( expect.arrayContaining( [
				expect.any( plugins.constructors.ManifestPlugin ),
			] ) );
			const manifestPlugins = config.plugins.filter( filterPlugins( ManifestPlugin ) );
			expect( manifestPlugins.length ).toBe( 1 );
			expect( manifestPlugins[ 0 ].options.fileName ).toEqual( 'custom-manifest.json' );
		} );

		it( 'uses a consistent seed for manifests generated in the same directory', () => {
			const { ManifestPlugin } = plugins.constructors;
			const [ manifest1 ] = production( {
				entry: { main: 'some-file' },
				output: { path: '/some/path' },
			} )
				.plugins
				.filter( filterPlugins( ManifestPlugin ) );
			const [ manifest2 ] = production( {
				entry: { main: 'some-file' },
				output: { path: '/some/path' },
			} )
				.plugins
				.filter( filterPlugins( ManifestPlugin ) );
			const [ manifest3 ] = production( {
				entry: { main: 'some-file' },
				output: { path: '/some/DIFFERENT/path' },
			} )
				.plugins
				.filter( filterPlugins( ManifestPlugin ) );
			// Ensure the two builds in the same folder use the same seed.
			expect( manifest1.options.seed ).toEqual( {} );
			expect( manifest2.options.seed ).toEqual( {} );
			expect( manifest1 ).not.toBe( manifest2 );
			expect( manifest1.options.seed ).toBe( manifest2.options.seed );
			// Ensure the build to the other output.path uses a different seed.
			expect( manifest3 ).not.toBe( manifest1 );
			expect( manifest3 ).not.toBe( manifest2 );
			expect( manifest3.options.seed ).toEqual( {} );
			expect( manifest3.options.seed ).not.toBe( manifest2.options.seed );
			expect( manifest3.options.seed ).not.toBe( manifest1.options.seed );
		} );

		it( 'permits filtering the computed output of individual loaders', () => {
			const config = production( {
				entry: {
					main: 'some-file.js',
				},
			}, {
				filterLoaders: ( loader, loaderType ) => {
					if ( loaderType === 'file' ) {
						loader.options.publicPath = '../../';
					}
					if ( loaderType === 'url' ) {
						loader.test = /\.(png|jpg|jpeg|gif|svg)$/;
					}
					return loader;
				},
			} );
			const fileLoader = getLoaderByName( config.module.rules, 'file-loader' );
			const urlLoader = getLoaderByName( config.module.rules, 'url-loader' );
			const jsLoader = getLoaderByName( config.module.rules, 'babel-loader' );
			expect( fileLoader ).toEqual( expect.objectContaining( {
				exclude: /\.(js|html|json)$/,
				options: {
					publicPath: '../../',
				},
			} ) );
			expect( urlLoader ).toEqual( expect.objectContaining( {
				test: /\.(png|jpg|jpeg|gif|svg)$/,
				options: {
					limit: 10000,
				},
			} ) );
			expect( jsLoader ).not.toBeNull();
		} );

		it( 'permits filtering the entire stylesheet loader chain', () => {
			const config = production( {
				entry: {
					main: 'some-file.js',
				},
			}, {
				filterLoaders: ( loader, loaderType ) => {
					if ( loaderType === 'stylesheet' ) {
						loader.test = /\.styl$/;
					}
					if ( loaderType === 'sass' ) {
						return {
							loader: 'stylus',
						};
					}
					return loader;
				},
			} );
			const styleChain = getLoaderByTest( config.module.rules, /\.styl$/ );
			expect( styleChain ).toEqual( {
				test: /\.styl$/,
				use: expect.arrayContaining( [
					{
						loader: 'stylus',
					},
				] ),
			} );
			const sassLoader = getLoaderByTest( config.module.rules, /\.s?css$/ );
			expect( sassLoader ).toBeNull();
		} );
	} );
} );
