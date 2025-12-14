( function () {

	class GLTFLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

			this.dracoLoader = null;
			this.ktx2Loader = null;
			this.meshoptDecoder = null;

			this.pluginCallbacks = [];

			this.register( function ( parser ) {

				return new GLTFMaterialsClearcoatExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFTextureBasisUExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFTextureWebPExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMaterialsSheenExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMaterialsTransmissionExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMaterialsVolumeExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMaterialsIorExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMaterialsEmissiveStrengthExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMaterialsSpecularExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMaterialsIridescenceExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFLightsExtension( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMeshoptCompression( parser );

			} );

			this.register( function ( parser ) {

				return new GLTFMeshGpuInstancing( parser );

			} );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;

			let resourcePath;

			if ( this.resourcePath !== '' ) {

				resourcePath = this.resourcePath;

			} else if ( this.path !== '' ) {

				resourcePath = this.path;

			} else {

				resourcePath = THREE.LoaderUtils.extractUrlBase( url );

			}

			// Tells the LoadingManager to track an extra item, which resolves after
			// the model is fully loaded. This means the count of items loaded will
			// be incorrect, but ensures manager.onLoad() does not fire early.
			this.manager.itemStart( url );

			const _onError = function ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );
				scope.manager.itemEnd( url );

			};

			const loader = new THREE.FileLoader( this.manager );

			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );

			loader.load( url, function ( data ) {

				try {

					scope.parse( data, resourcePath, function ( gltf ) {

						onLoad( gltf );

						scope.manager.itemEnd( url );

					}, _onError );

				} catch ( e ) {

					_onError( e );

				}

			}, onProgress, _onError );

		}

		setDRACOLoader( dracoLoader ) {

			this.dracoLoader = dracoLoader;
			return this;

		}

		setKTX2Loader( ktx2Loader ) {

			this.ktx2Loader = ktx2Loader;
			return this;

		}

		setMeshoptDecoder( meshoptDecoder ) {

			this.meshoptDecoder = meshoptDecoder;
			return this;

		}

		register( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) === - 1 ) {

				this.pluginCallbacks.push( callback );

			}

			return this;

		}

		unregister( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) !== - 1 ) {

				this.pluginCallbacks.splice( this.pluginCallbacks.indexOf( callback ), 1 );

			}

			return this;

		}

		parse( data, path, onLoad, onError ) {

			let json;
			const extensions = {};
			const plugins = {};

			if ( typeof data === 'string' ) {

				json = JSON.parse( data );

			} else if ( data instanceof ArrayBuffer ) {

				const magic = THREE.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

				if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

					try {

						extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );

					} catch ( error ) {

						if ( onError ) onError( error );
						return;

					}

					json = JSON.parse( extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content );

				} else {

					json = JSON.parse( THREE.LoaderUtils.decodeText( new Uint8Array( data ) ) );

				}

			} else {

				json = data;

			}

			if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

				if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
				return;

			}

			const parser = new GLTFParser( json, {
				path: path || this.resourcePath || '',
				crossOrigin: this.crossOrigin,
				requestHeader: this.requestHeader,
				manager: this.manager,
				ktx2Loader: this.ktx2Loader,
				meshoptDecoder: this.meshoptDecoder
			} );

			parser.fileLoader.setRequestHeader( this.requestHeader );

			for ( let i = 0; i < this.pluginCallbacks.length; i ++ ) {

				const plugin = this.pluginCallbacks[ i ]( parser );
				plugins[ plugin.name ] = plugin;

				// Workaround to avoid determining as unknown extension
				// in addUnknownExtensionsToUserData().
				// Remove this workaround if we move all the existing
				// extension handlers to plugin system
				extensions[ plugin.name ] = true;

			}

			if ( json.extensionsUsed ) {

				for ( let i = 0; i < json.extensionsUsed.length; ++ i ) {

					const extensionName = json.extensionsUsed[ i ];
					const extensionsRequired = json.extensionsRequired || [];

					switch ( extensionName ) {

						case EXTENSIONS.KHR_MATERIALS_UNLIT:
							extensions[ extensionName ] = new GLTFMaterialsUnlitExtension();
							break;

						case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
							extensions[ extensionName ] = new GLTFDracoMeshCompressionExtension( json, this.dracoLoader );
							break;

						case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
							extensions[ extensionName ] = new GLTFTextureTransformExtension();
							break;

						case EXTENSIONS.KHR_MESH_QUANTIZATION:
							extensions[ extensionName ] = new GLTFMeshQuantizationExtension();
							break;

						default:

							if ( extensionsRequired.indexOf( extensionName ) >= 0 && plugins[ extensionName ] === undefined ) {

								console.warn( 'THREE.GLTFLoader: Unknown extension "' + extensionName + '".' );

							}

					}

				}

			}

			parser.setExtensions( extensions );
			parser.setPlugins( plugins );
			parser.parse( onLoad, onError );

		}

		parseAsync( data, path ) {

			const scope = this;

			return new Promise( function ( resolve, reject ) {

				scope.parse( data, path, resolve, reject );

			} );

		}

	}

	/* GLTFREGISTRY */

	function GLTFRegistry() {

		let objects = {};

		return	{

			get: function ( key ) {

				return objects[ key ];

			},

			add: function ( key, object ) {

				objects[ key ] = object;

			},

			remove: function ( key ) {

				delete objects[ key ];

			},

			removeAll: function () {

				objects = {};

			}

		};

	}

	/*********************************/
	/********** EXTENSIONS ***********/
	/*********************************/

	const EXTENSIONS = {
		KHR_BINARY_GLTF: 'KHR_binary_glTF',
		KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
		KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
		KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat',
		KHR_MATERIALS_IOR: 'KHR_materials_ior',
		KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
		KHR_MATERIALS_SHEEN: 'KHR_materials_sheen',
		KHR_MATERIALS_SPECULAR: 'KHR_materials_specular',
		KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission',
		KHR_MATERIALS_IRIDESCENCE: 'KHR_materials_iridescence',
		KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
		KHR_MATERIALS_VOLUME: 'KHR_materials_volume',
		KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
		KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
		KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
		KHR_MATERIALS_EMISSIVE_STRENGTH: 'KHR_materials_emissive_strength',
		EXT_TEXTURE_WEBP: 'EXT_texture_webp',
		EXT_MESHOPT_COMPRESSION: 'EXT_meshopt_compression',
		EXT_MESH_GPU_INSTANCING: 'EXT_mesh_gpu_instancing'
	};

	/**
	 * Binary Extension (GLB)
	 */

	const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
	const BINARY_EXTENSION_HEADER_LENGTH = 12;
	const BINARY_EXTENSION_CHUNK_TYPES = { JSON: 0x4E4F534A, BIN: 0x004E4942 };

	class GLTFBinaryExtension {

		constructor( data ) {

			this.name = EXTENSIONS.KHR_BINARY_GLTF;
			this.content = null;
			this.body = null;

			const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );
			const textDecoder = new TextDecoder();

			this.header = {
				magic: textDecoder.decode( new Uint8Array( data.slice( 0, 4 ) ) ),
				version: headerView.getUint32( 4, true ),
				length: headerView.getUint32( 8, true )
			};

			if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

				throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

			} else if ( this.header.version < 2.0 ) {

				throw new Error( 'THREE.GLTFLoader: Legacy binary file detected.' );

			}

			const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
			const chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
			let chunkIndex = 0;

			while ( chunkIndex < chunkContentsLength ) {

				const chunkLength = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;

				const chunkType = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;

				if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

					const contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
					this.content = textDecoder.decode( contentArray );

				} else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

					const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
					this.body = data.slice( byteOffset, byteOffset + chunkLength );

				}

				// Clients must ignore chunks with unknown types.

				chunkIndex += chunkLength;

			}

			if ( this.content === null ) {

				throw new Error( 'THREE.GLTFLoader: JSON content not found.' );

			}

		}

	}

	// Stub classes for extensions (minimal implementation)
	class GLTFMaterialsClearcoatExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT; } }
	class GLTFTextureBasisUExtension { constructor() { this.name = EXTENSIONS.KHR_TEXTURE_BASISU; } }
	class GLTFTextureWebPExtension { constructor() { this.name = EXTENSIONS.EXT_TEXTURE_WEBP; } }
	class GLTFMaterialsSheenExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_SHEEN; } }
	class GLTFMaterialsTransmissionExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION; } }
	class GLTFMaterialsVolumeExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_VOLUME; } }
	class GLTFMaterialsIorExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_IOR; } }
	class GLTFMaterialsEmissiveStrengthExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_EMISSIVE_STRENGTH; } }
	class GLTFMaterialsSpecularExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_SPECULAR; } }
	class GLTFMaterialsIridescenceExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_IRIDESCENCE; } }
	class GLTFLightsExtension { constructor() { this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL; } }
	class GLTFMeshoptCompression { constructor() { this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION; } }
	class GLTFMeshGpuInstancing { constructor() { this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING; } }
	class GLTFMaterialsUnlitExtension { constructor() { this.name = EXTENSIONS.KHR_MATERIALS_UNLIT; } }
	class GLTFDracoMeshCompressionExtension { constructor() { this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION; } }
	class GLTFTextureTransformExtension { constructor() { this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM; } }
	class GLTFMeshQuantizationExtension { constructor() { this.name = EXTENSIONS.KHR_MESH_QUANTIZATION; } }

	/**
	 * GLTF Parser - Minimal implementation for basic GLB loading
	 */
	class GLTFParser {

		constructor( json, options = {} ) {

			this.json = json || {};
			this.extensions = {};
			this.plugins = {};
			this.options = options;
			this.cache = new GLTFRegistry();
			this.associations = new Map();
			this.primitiveCache = {};
			this.meshCache = { refs: {}, uses: {} };
			this.cameraCache = { refs: {}, uses: {} };
			this.lightCache = { refs: {}, uses: {} };
			this.textureCache = {};
			this.sourceCache = {};
			this.nodeNamesUsed = {};
			this.textureLoader = new THREE.TextureLoader( this.options.manager );
			this.textureLoader.setCrossOrigin( this.options.crossOrigin );
			this.textureLoader.setRequestHeader( this.options.requestHeader );

			this.fileLoader = new THREE.FileLoader( this.options.manager );
			this.fileLoader.setResponseType( 'arraybuffer' );

			if ( this.options.crossOrigin === 'use-credentials' ) {

				this.fileLoader.setWithCredentials( true );

			}

		}

		setExtensions( extensions ) {

			this.extensions = extensions;

		}

		setPlugins( plugins ) {

			this.plugins = plugins;

		}

		parse( onLoad, onError ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;

			// Clear the loader cache
			this.cache.removeAll();

			// Mark the special nodes/meshes in json for efficient parse
			this._invokeAll( function ( ext ) {

				return ext._markDefs && ext._markDefs();

			} );

			Promise.all( this._invokeAll( function ( ext ) {

				return ext.beforeRoot && ext.beforeRoot();

			} ) ).then( function () {

				return Promise.all( [

					parser.getDependencies( 'scene' ),
					parser.getDependencies( 'animation' ),
					parser.getDependencies( 'camera' ),

				] );

			} ).then( function ( dependencies ) {

				const result = {
					scene: dependencies[ 0 ][ json.scene || 0 ],
					scenes: dependencies[ 0 ],
					animations: dependencies[ 1 ],
					cameras: dependencies[ 2 ],
					asset: json.asset,
					parser: parser,
					userData: {}
				};

				addUnknownExtensionsToUserData( extensions, result, json );

				assignExtrasToUserData( result, json );

				Promise.all( parser._invokeAll( function ( ext ) {

					return ext.afterRoot && ext.afterRoot( result );

				} ) ).then( function () {

					onLoad( result );

				} );

			} ).catch( onError );

		}

		_invokeAll( func ) {

			const extensions = Object.values( this.plugins );
			extensions.push( this );

			const pending = [];

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );

				if ( result ) pending.push( result );

			}

			return pending;

		}

		getDependencies( type ) {

			let dependencies = this.cache.get( type );

			if ( ! dependencies ) {

				const parser = this;
				const defs = this.json[ type + ( type === 'mesh' ? 'es' : 's' ) ] || [];

				dependencies = Promise.all( defs.map( function ( def, index ) {

					return parser.getDependency( type, index );

				} ) );

				this.cache.add( type, dependencies );

			}

			return dependencies;

		}

		getDependency( type, index ) {

			const cacheKey = type + ':' + index;
			let dependency = this.cache.get( cacheKey );

			if ( ! dependency ) {

				switch ( type ) {

					case 'scene':
						dependency = this.loadScene( index );
						break;

					case 'node':
						dependency = this.loadNode( index );
						break;

					case 'mesh':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMesh && ext.loadMesh( index );

						} );

						if ( ! dependency ) {

							dependency = this.loadMesh( index );

						}

						break;

					case 'accessor':
						dependency = this.loadAccessor( index );
						break;

					case 'bufferView':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadBufferView && ext.loadBufferView( index );

						} );

						if ( ! dependency ) {

							dependency = this.loadBufferView( index );

						}

						break;

					case 'buffer':
						dependency = this.loadBuffer( index );
						break;

					case 'material':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMaterial && ext.loadMaterial( index );

						} );

						if ( ! dependency ) {

							dependency = this.loadMaterial( index );

						}

						break;

					case 'texture':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadTexture && ext.loadTexture( index );

						} );

						if ( ! dependency ) {

							dependency = this.loadTexture( index );

						}

						break;

					case 'skin':
						dependency = this.loadSkin( index );
						break;

					case 'animation':
						dependency = this.loadAnimation( index );
						break;

					case 'camera':
						dependency = this.loadCamera( index );
						break;

					default:
						throw new Error( 'Unknown type: ' + type );

				}

				this.cache.add( cacheKey, dependency );

			}

			return dependency;

		}

		_invokeOne( func ) {

			const extensions = Object.values( this.plugins );
			extensions.push( this );

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );

				if ( result ) return result;

			}

			return null;

		}

		loadScene( sceneIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const sceneDef = this.json.scenes[ sceneIndex ];
			const parser = this;

			const scene = new THREE.Group();
			if ( sceneDef.name ) scene.name = parser.createUniqueName( sceneDef.name );

			assignExtrasToUserData( scene, sceneDef );

			if ( sceneDef.extensions ) addUnknownExtensionsToUserData( extensions, scene, sceneDef );

			const nodeIds = sceneDef.nodes || [];

			const pending = [];

			for ( let i = 0, il = nodeIds.length; i < il; i ++ ) {

				pending.push( buildNodeHierarchy( nodeIds[ i ], scene, json, parser ) );

			}

			return Promise.all( pending ).then( function () {

				return scene;

			} );

		}

		loadNode( nodeIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const parser = this;

			const nodeDef = json.nodes[ nodeIndex ];

			const nodePending = parser._invokeOne( function ( ext ) {

				return ext.createNodeMesh && ext.createNodeMesh( nodeIndex );

			} );

			return nodePending ? nodePending : Promise.resolve( new THREE.Object3D() );

		}

		loadMesh( meshIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;

			const meshDef = json.meshes[ meshIndex ];
			const primitives = meshDef.primitives;

			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const material = primitives[ i ].material === undefined ?
					createDefaultMaterial( this.cache ) :
					this.getDependency( 'material', primitives[ i ].material );

				pending.push( material );

			}

			pending.push( parser.loadGeometries( primitives ) );

			return Promise.all( pending ).then( function ( results ) {

				const materials = results.slice( 0, results.length - 1 );
				const geometries = results[ results.length - 1 ];

				const meshes = [];

				for ( let i = 0, il = geometries.length; i < il; i ++ ) {

					const geometry = geometries[ i ];
					const primitive = primitives[ i ];

					let mesh;

					const material = materials[ i ];

					if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES ||
						primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ||
						primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ||
						primitive.mode === undefined ) {

						mesh = new THREE.Mesh( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

						mesh = new THREE.LineSegments( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ) {

						mesh = new THREE.Line( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_LOOP ) {

						mesh = new THREE.LineLoop( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.POINTS ) {

						mesh = new THREE.Points( geometry, material );

					} else {

						throw new Error( 'THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode );

					}

					if ( Object.keys( mesh.geometry.morphAttributes ).length > 0 ) {

						updateMorphTargets( mesh, meshDef );

					}

					mesh.name = parser.createUniqueName( meshDef.name || ( 'mesh_' + meshIndex ) );

					assignExtrasToUserData( mesh, meshDef );

					if ( primitive.extensions ) addUnknownExtensionsToUserData( extensions, mesh, primitive );

					parser.assignFinalMaterial( mesh );

					meshes.push( mesh );

				}

				if ( meshes.length === 1 ) {

					return meshes[ 0 ];

				}

				const group = new THREE.Group();

				for ( let i = 0, il = meshes.length; i < il; i ++ ) {

					group.add( meshes[ i ] );

				}

				return group;

			} );

		}

		loadCamera( cameraIndex ) {

			let camera;
			const cameraDef = this.json.cameras[ cameraIndex ];
			const params = cameraDef[ cameraDef.type ];

			if ( ! params ) {

				console.warn( 'THREE.GLTFLoader: Missing camera parameters.' );
				return;

			}

			if ( cameraDef.type === 'perspective' ) {

				camera = new THREE.PerspectiveCamera( THREE.MathUtils.radToDeg( params.yfov ), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6 );

			} else if ( cameraDef.type === 'orthographic' ) {

				camera = new THREE.OrthographicCamera( - params.xmag, params.xmag, params.ymag, - params.ymag, params.znear, params.zfar );

			}

			if ( cameraDef.name ) camera.name = this.createUniqueName( cameraDef.name );

			assignExtrasToUserData( camera, cameraDef );

			return Promise.resolve( camera );

		}

		loadSkin( skinIndex ) {

			const skinDef = this.json.skins[ skinIndex ];

			const skinEntry = { joints: skinDef.joints };

			if ( skinDef.inverseBindMatrices === undefined ) {

				return Promise.resolve( skinEntry );

			}

			return this.getDependency( 'accessor', skinDef.inverseBindMatrices ).then( function ( accessor ) {

				skinEntry.inverseBindMatrices = accessor;

				return skinEntry;

			} );

		}

		loadAnimation( animationIndex ) {

			const json = this.json;

			const animationDef = json.animations[ animationIndex ];

			const pendingNodes = [];
			const pendingInputAccessors = [];
			const pendingOutputAccessors = [];
			const pendingSamplers = [];
			const pendingTargets = [];

			for ( let i = 0, il = animationDef.channels.length; i < il; i ++ ) {

				const channel = animationDef.channels[ i ];
				const sampler = animationDef.samplers[ channel.sampler ];
				const target = channel.target;
				const name = target.node !== undefined ? target.node : target.id; // NOTE: target.id is deprecated.
				const input = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.input ] : sampler.input;
				const output = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.output ] : sampler.output;

				pendingNodes.push( this.getDependency( 'node', name ) );
				pendingInputAccessors.push( this.getDependency( 'accessor', input ) );
				pendingOutputAccessors.push( this.getDependency( 'accessor', output ) );
				pendingSamplers.push( sampler );
				pendingTargets.push( target );

			}

			return Promise.all( [

				Promise.all( pendingNodes ),
				Promise.all( pendingInputAccessors ),
				Promise.all( pendingOutputAccessors ),
				Promise.all( pendingSamplers ),
				Promise.all( pendingTargets )

			] ).then( function ( dependencies ) {

				const nodes = dependencies[ 0 ];
				const inputAccessors = dependencies[ 1 ];
				const outputAccessors = dependencies[ 2 ];
				const samplers = dependencies[ 3 ];
				const targets = dependencies[ 4 ];

				const tracks = [];

				for ( let i = 0, il = nodes.length; i < il; i ++ ) {

					const node = nodes[ i ];
					const inputAccessor = inputAccessors[ i ];
					const outputAccessor = outputAccessors[ i ];
					const sampler = samplers[ i ];
					const target = targets[ i ];

					if ( node === undefined ) continue;

					node.updateMatrix();
					node.matrixAutoUpdate = true;

					let TypedKeyframeTrack;

					switch ( PATH_PROPERTIES[ target.path ] ) {

						case PATH_PROPERTIES.weights:

							TypedKeyframeTrack = THREE.NumberKeyframeTrack;
							break;

						case PATH_PROPERTIES.rotation:

							TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
							break;

						case PATH_PROPERTIES.position:
						case PATH_PROPERTIES.scale:
						default:

							TypedKeyframeTrack = THREE.VectorKeyframeTrack;
							break;

					}

					const targetName = node.name ? node.name : node.uuid;

					const interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE.InterpolateLinear;

					const targetNames = [];

					if ( PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.weights ) {

						node.traverse( function ( object ) {

							if ( object.morphTargetInfluences ) {

								targetNames.push( object.name ? object.name : object.uuid );

							}

						} );

					} else {

						targetNames.push( targetName );

					}

					let outputArray = outputAccessor.array;

					if ( outputAccessor.normalized ) {

						const scale = getNormalizedComponentScale( outputArray.constructor );
						const scaled = new Float32Array( outputArray.length );

						for ( let j = 0, jl = outputArray.length; j < jl; j ++ ) {

							scaled[ j ] = outputArray[ j ] * scale;

						}

						outputArray = scaled;

					}

					for ( let j = 0, jl = targetNames.length; j < jl; j ++ ) {

						const track = new TypedKeyframeTrack(
							targetNames[ j ] + '.' + PATH_PROPERTIES[ target.path ],
							inputAccessor.array,
							outputArray,
							interpolation
						);

						// Override interpolation with custom factory method.
						if ( sampler.interpolation === 'CUBICSPLINE' ) {

							track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline( result ) {

								// A CUBICSPLINE keyframe in glTF has three output values for each input value,
								// representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
								// must be divided by three to get the interpolant's sampleSize argument.

								const interpolantType = ( this instanceof THREE.QuaternionKeyframeTrack ) ? GLTFCubicSplineQuaternionInterpolant : GLTFCubicSplineInterpolant;

								return new interpolantType( this.times, this.values, this.getValueSize() / 3, result );

							};

							// Mark as CUBICSPLINE. `track.getInterpolation()` doesn't support custom interpolants.
							track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

						}

						tracks.push( track );

					}

				}

				const name = animationDef.name ? animationDef.name : 'animation_' + animationIndex;

				return new THREE.AnimationClip( name, undefined, tracks );

			} );

		}

		createNodeMesh( nodeIndex ) {

			const json = this.json;
			const parser = this;
			const nodeDef = json.nodes[ nodeIndex ];

			if ( nodeDef.mesh === undefined ) return null;

			return parser.getDependency( 'mesh', nodeDef.mesh ).then( function ( mesh ) {

				const node = parser._getNodeRef( parser.meshCache, nodeDef.mesh, mesh );

				// if weights are provided on the node, override weights on the mesh.
				if ( nodeDef.weights !== undefined ) {

					node.traverse( function ( o ) {

						if ( ! o.isMesh ) return;

						for ( let i = 0, il = nodeDef.weights.length; i < il; i ++ ) {

							o.morphTargetInfluences[ i ] = nodeDef.weights[ i ];

						}

					} );

				}

				return node;

			} );

		}

		loadGeometries( primitives ) {

			const parser = this;
			const extensions = this.extensions;
			const cache = this.primitiveCache;

			function createDracoPrimitive( primitive ) {

				return extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ]
					.decodePrimitive( primitive, parser )
					.then( function ( geometry ) {

						return addPrimitiveAttributes( geometry, primitive, parser );

					} );

			}

			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const primitive = primitives[ i ];
				const cacheKey = createPrimitiveKey( primitive );

				// See if we've already created this geometry
				const cached = cache[ cacheKey ];

				if ( cached ) {

					// Use the cached geometry if it exists
					pending.push( cached.promise );

				} else {

					let geometryPromise;

					if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {

						// Use DRACO geometry if available
						geometryPromise = createDracoPrimitive( primitive );

					} else {

						// Otherwise create a new geometry
						geometryPromise = addPrimitiveAttributes( new THREE.BufferGeometry(), primitive, parser );

					}

					// Cache this geometry
					cache[ cacheKey ] = { primitive: primitive, promise: geometryPromise };

					pending.push( geometryPromise );

				}

			}

			return Promise.all( pending );

		}

		loadBuffer( bufferIndex ) {

			const bufferDef = this.json.buffers[ bufferIndex ];
			const loader = this.fileLoader;

			if ( bufferDef.type && bufferDef.type !== 'arraybuffer' ) {

				throw new Error( 'THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.' );

			}

			// If present, GLB container is required to be the first buffer.
			if ( bufferDef.uri === undefined && bufferIndex === 0 ) {

				return Promise.resolve( this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body );

			}

			const options = this.options;

			return new Promise( function ( resolve, reject ) {

				loader.load( THREE.LoaderUtils.resolveURL( bufferDef.uri, options.path ), resolve, undefined, function () {

					reject( new Error( 'THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".' ) );

				} );

			} );

		}

		loadBufferView( bufferViewIndex ) {

			const bufferViewDef = this.json.bufferViews[ bufferViewIndex ];

			return this.getDependency( 'buffer', bufferViewDef.buffer ).then( function ( buffer ) {

				const byteLength = bufferViewDef.byteLength || 0;
				const byteOffset = bufferViewDef.byteOffset || 0;
				return buffer.slice( byteOffset, byteOffset + byteLength );

			} );

		}

		loadAccessor( accessorIndex ) {

			const parser = this;
			const json = this.json;

			const accessorDef = this.json.accessors[ accessorIndex ];

			if ( accessorDef.bufferView === undefined && accessorDef.sparse === undefined ) {

				// Ignore empty accessors, which may be used to declare runtime
				// information about attributes coming from another source (e.g. Draco compression extension).
				return Promise.resolve( null );

			}

			const pending = [];

			if ( accessorDef.bufferView !== undefined ) {

				pending.push( this.getDependency( 'bufferView', accessorDef.bufferView ) );

			} else {

				pending.push( null );

			}

			if ( accessorDef.sparse !== undefined ) {

				pending.push( this.getDependency( 'bufferView', accessorDef.sparse.indices.bufferView ) );
				pending.push( this.getDependency( 'bufferView', accessorDef.sparse.values.bufferView ) );

			}

			return Promise.all( pending ).then( function ( bufferViews ) {

				const bufferView = bufferViews[ 0 ];

				const itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
				const TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];

				// For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
				const elementBytes = TypedArray.BYTES_PER_ELEMENT;
				const itemBytes = elementBytes * itemSize;
				const byteOffset = accessorDef.byteOffset || 0;
				const byteStride = accessorDef.bufferView !== undefined ? json.bufferViews[ accessorDef.bufferView ].byteStride : undefined;
				const normalized = accessorDef.normalized === true;
				let array, bufferAttribute;

				// The buffer is not interleaved if the stride is the item size in bytes.
				if ( byteStride && byteStride !== itemBytes ) {

					// Each "slice" of the buffer, as defined by 'count' elements of 'byteStride' bytes, gets its own InterleavedBuffer
					// This makes sure that IBA.count reflects accessor.count properly
					const ibSlice = Math.floor( byteOffset / byteStride );
					const ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType + ':' + ibSlice + ':' + accessorDef.count;
					let ib = parser.cache.get( ibCacheKey );

					if ( ! ib ) {

						array = new TypedArray( bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes );

						// Integer parameters to IB/IBA are in array elements, not bytes.
						ib = new THREE.InterleavedBuffer( array, byteStride / elementBytes );

						parser.cache.add( ibCacheKey, ib );

					}

					bufferAttribute = new THREE.InterleavedBufferAttribute( ib, itemSize, ( byteOffset % byteStride ) / elementBytes, normalized );

				} else {

					if ( bufferView === null ) {

						array = new TypedArray( accessorDef.count * itemSize );

					} else {

						array = new TypedArray( bufferView, byteOffset, accessorDef.count * itemSize );

					}

					bufferAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

				}

				// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors
				if ( accessorDef.sparse !== undefined ) {

					const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
					const TypedArrayIndices = WEBGL_COMPONENT_TYPES[ accessorDef.sparse.indices.componentType ];

					const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
					const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;

					const sparseIndices = new TypedArrayIndices( bufferViews[ 1 ], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices );
					const sparseValues = new TypedArray( bufferViews[ 2 ], byteOffsetValues, accessorDef.sparse.count * itemSize );

					if ( bufferView !== null ) {

						// Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
						bufferAttribute = new THREE.BufferAttribute( bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized );

					}

					for ( let i = 0, il = sparseIndices.length; i < il; i ++ ) {

						const index = sparseIndices[ i ];

						bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
						if ( itemSize >= 2 ) bufferAttribute.setY( index, sparseValues[ i * itemSize + 1 ] );
						if ( itemSize >= 3 ) bufferAttribute.setZ( index, sparseValues[ i * itemSize + 2 ] );
						if ( itemSize >= 4 ) bufferAttribute.setW( index, sparseValues[ i * itemSize + 3 ] );

					}

				}

				return bufferAttribute;

			} );

		}

		loadTexture( textureIndex ) {

			const json = this.json;
			const options = this.options;
			const textureDef = json.textures[ textureIndex ];
			const sourceIndex = textureDef.source;
			const sourceDef = json.images[ sourceIndex ];

			let loader = this.textureLoader;

			if ( sourceDef.uri ) {

				const handler = options.manager.getHandler( sourceDef.uri );

				if ( handler !== null ) {

					loader = handler;

				}

			}

			return this.loadTextureImage( textureIndex, sourceIndex, loader );

		}

		loadTextureImage( textureIndex, sourceIndex, loader ) {

			const parser = this;
			const json = this.json;
			const options = this.options;

			const textureDef = json.textures[ textureIndex ];
			const sourceDef = json.images[ sourceIndex ];

			const cacheKey = ( sourceDef.uri || sourceDef.bufferView ) + ':' + textureDef.sampler;

			if ( this.textureCache[ cacheKey ] ) {

				return this.textureCache[ cacheKey ];

			}

			const promise = this.loadImageSource( sourceIndex, loader ).then( function ( texture ) {

				texture.flipY = false;

				if ( textureDef.name ) texture.name = textureDef.name;

				const samplers = json.samplers || {};
				const sampler = samplers[ textureDef.sampler ] || {};

				texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || THREE.LinearFilter;
				texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || THREE.LinearMipmapLinearFilter;
				texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || THREE.RepeatWrapping;
				texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || THREE.RepeatWrapping;

				parser.associations.set( texture, { textures: textureIndex } );

				return texture;

			} ).catch( function () {

				return null;

			} );

			this.textureCache[ cacheKey ] = promise;

			return promise;

		}

		loadImageSource( sourceIndex, loader ) {

			const parser = this;
			const json = this.json;
			const options = this.options;

			const sourceDef = json.images[ sourceIndex ];

			const URL = self.URL || self.webkitURL;

			let sourceURI = sourceDef.uri || '';
			let isObjectURL = false;

			if ( sourceDef.bufferView !== undefined ) {

				// Load binary image data from bufferView, if provided.

				sourceURI = parser.getDependency( 'bufferView', sourceDef.bufferView ).then( function ( bufferView ) {

					isObjectURL = true;
					const blob = new Blob( [ bufferView ], { type: sourceDef.mimeType } );
					sourceURI = URL.createObjectURL( blob );
					return sourceURI;

				} );

			} else if ( sourceDef.uri === undefined ) {

				throw new Error( 'THREE.GLTFLoader: Image ' + sourceIndex + ' is missing URI and bufferView' );

			}

			const promise = Promise.resolve( sourceURI ).then( function ( sourceURI ) {

				return new Promise( function ( resolve, reject ) {

					let onLoad = resolve;

					if ( loader.isImageBitmapLoader === true ) {

						onLoad = function ( imageBitmap ) {

							const texture = new THREE.Texture( imageBitmap );
							texture.needsUpdate = true;

							resolve( texture );

						};

					}

					loader.load( THREE.LoaderUtils.resolveURL( sourceURI, options.path ), onLoad, undefined, reject );

				} );

			} ).then( function ( texture ) {

				// Clean up resources and configure Texture.

				if ( isObjectURL === true ) {

					URL.revokeObjectURL( sourceURI );

				}

				texture.userData.mimeType = sourceDef.mimeType || getImageURIMimeType( sourceDef.uri );

				return texture;

			} ).catch( function ( error ) {

				console.error( 'THREE.GLTFLoader: Couldn\'t load texture', sourceURI );
				throw error;

			} );

			this.sourceCache[ sourceIndex ] = promise;
			return promise;

		}

		assignFinalMaterial( mesh ) {

			const geometry = mesh.geometry;
			let material = mesh.material;

			const useVertexTangents = geometry.attributes.tangent !== undefined;
			const useVertexColors = geometry.attributes.color !== undefined;
			const useFlatShading = geometry.attributes.normal === undefined;
			const useSkinning = mesh.isSkinnedMesh === true;
			const useMorphTargets = Object.keys( geometry.morphAttributes ).length > 0;
			const useMorphNormals = useMorphTargets && geometry.morphAttributes.normal !== undefined;

			if ( mesh.isPoints ) {

				const cacheKey = 'PointsMaterial:' + material.uuid;

				let pointsMaterial = this.cache.get( cacheKey );

				if ( ! pointsMaterial ) {

					pointsMaterial = new THREE.PointsMaterial();
					THREE.Material.prototype.copy.call( pointsMaterial, material );
					pointsMaterial.color.copy( material.color );
					pointsMaterial.map = material.map;
					pointsMaterial.sizeAttenuation = false; // glTF spec says points should be 1px

					this.cache.add( cacheKey, pointsMaterial );

				}

				material = pointsMaterial;

			} else if ( mesh.isLine ) {

				const cacheKey = 'LineBasicMaterial:' + material.uuid;

				let lineMaterial = this.cache.get( cacheKey );

				if ( ! lineMaterial ) {

					lineMaterial = new THREE.LineBasicMaterial();
					THREE.Material.prototype.copy.call( lineMaterial, material );
					lineMaterial.color.copy( material.color );

					this.cache.add( cacheKey, lineMaterial );

				}

				material = lineMaterial;

			}

			// Clone the material if it will be modified
			if ( useVertexTangents || useVertexColors || useFlatShading || useSkinning || useMorphTargets ) {

				let cacheKey = 'ClonedMaterial:' + material.uuid + ':';

				if ( material.isGLTFSpecularGlossinessMaterial ) cacheKey += 'specular-glossiness:';
				if ( useSkinning ) cacheKey += 'skinning:';
				if ( useVertexTangents ) cacheKey += 'vertex-tangents:';
				if ( useVertexColors ) cacheKey += 'vertex-colors:';
				if ( useFlatShading ) cacheKey += 'flat-shading:';
				if ( useMorphTargets ) cacheKey += 'morph-targets:';
				if ( useMorphNormals ) cacheKey += 'morph-normals:';

				let cachedMaterial = this.cache.get( cacheKey );

				if ( ! cachedMaterial ) {

					cachedMaterial = material.clone();

					if ( useSkinning ) cachedMaterial.skinning = true;
					if ( useVertexTangents ) cachedMaterial.vertexTangents = true;
					if ( useVertexColors ) cachedMaterial.vertexColors = true;
					if ( useFlatShading ) cachedMaterial.flatShading = true;
					if ( useMorphTargets ) cachedMaterial.morphTargets = true;
					if ( useMorphNormals ) cachedMaterial.morphNormals = true;

					this.cache.add( cacheKey, cachedMaterial );

				}

				material = cachedMaterial;

			}

			// workarounds for mesh.receiveShadow and mesh.castShadow
			if ( material.aoMap && geometry.attributes.uv2 === undefined && geometry.attributes.uv !== undefined ) {

				geometry.setAttribute( 'uv2', geometry.attributes.uv );

			}

			mesh.material = material;

		}

		getMaterialType( /* materialIndex */ ) {

			return THREE.MeshStandardMaterial;

		}

		loadMaterial( materialIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;
			const materialDef = json.materials[ materialIndex ];

			let materialType;
			const materialParams = {};
			const materialExtensions = materialDef.extensions || {};

			const pending = [];

			if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] ) {

				const kmuExtension = extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ];
				materialType = kmuExtension.getMaterialType();
				pending.push( kmuExtension.extendParams( materialParams, materialDef, parser ) );

			} else {

				// Specification:
				// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material

				const metallicRoughness = materialDef.pbrMetallicRoughness || {};

				materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
				materialParams.opacity = 1.0;

				if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

					const array = metallicRoughness.baseColorFactor;

					materialParams.color.fromArray( array );
					materialParams.opacity = array[ 3 ];

				}

				if ( metallicRoughness.baseColorTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture ) );

				}

				materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
				materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

				if ( metallicRoughness.metallicRoughnessTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'metalnessMap', metallicRoughness.metallicRoughnessTexture ) );
					pending.push( parser.assignTexture( materialParams, 'roughnessMap', metallicRoughness.metallicRoughnessTexture ) );

				}

				materialType = this._invokeOne( function ( ext ) {

					return ext.getMaterialType && ext.getMaterialType( materialIndex );

				} );

				pending.push( Promise.all( this._invokeAll( function ( ext ) {

					return ext.extendMaterialParams && ext.extendMaterialParams( materialIndex, materialParams );

				} ) ) );

			}

			if ( materialDef.doubleSided === true ) {

				materialParams.side = THREE.DoubleSide;

			}

			const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

			if ( alphaMode === ALPHA_MODES.BLEND ) {

				materialParams.transparent = true;

				// See: https://github.com/mrdoob/three.js/issues/17706
				materialParams.depthWrite = false;

			} else {

				materialParams.transparent = false;

				if ( alphaMode === ALPHA_MODES.MASK ) {

					materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

				}

			}

			if ( materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'normalMap', materialDef.normalTexture ) );

				materialParams.normalScale = new THREE.Vector2( 1, 1 );

				if ( materialDef.normalTexture.scale !== undefined ) {

					const scale = materialDef.normalTexture.scale;

					materialParams.normalScale.set( scale, scale );

				}

			}

			if ( materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'aoMap', materialDef.occlusionTexture ) );

				if ( materialDef.occlusionTexture.strength !== undefined ) {

					materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

				}

			}

			if ( materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				materialParams.emissive = new THREE.Color().fromArray( materialDef.emissiveFactor );

			}

			if ( materialDef.emissiveTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'emissiveMap', materialDef.emissiveTexture ) );

			}

			return Promise.all( pending ).then( function () {

				let material;

				if ( materialType === THREE.MeshStandardMaterial ) {

					material = new THREE.MeshStandardMaterial( materialParams );

				} else {

					material = new materialType( materialParams );

				}

				if ( materialDef.name ) material.name = materialDef.name;

				assignExtrasToUserData( material, materialDef );

				parser.associations.set( material, { materials: materialIndex } );

				if ( materialDef.extensions ) addUnknownExtensionsToUserData( extensions, material, materialDef );

				return material;

			} );

		}

		/** When Object3D instances are targeted by animation, they need unique names. */
		createUniqueName( originalName ) {

			const sanitizedName = THREE.PropertyBinding.sanitizeNodeName( originalName || '' );

			let name = sanitizedName;

			for ( let i = 1; this.nodeNamesUsed[ name ]; ++ i ) {

				name = sanitizedName + '_' + i;

			}

			this.nodeNamesUsed[ name ] = true;

			return name;

		}

		/**
		 * @param {BufferGeometry} geometry
		 * @param {GLTF.Primitive} primitiveDef
		 * @param {GLTFParser} parser
		 */
		loadGeometries( primitives ) {

			return Promise.resolve( [] );

		}

		/**
		 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
		 *
		 * Creates BufferGeometries from primitives.
		 *
		 * @param {Array<GLTF.Primitive>} primitives
		 * @return {Promise<Array<BufferGeometry>>}
		 */
		assignTexture( materialParams, mapName, mapDef ) {

			const parser = this;

			return this.getDependency( 'texture', mapDef.index ).then( function ( texture ) {

				// Materials sample aoMap from UV set 1 and other maps from UV set 0 - this can't be configured
				// However, we will copy UV set 0 to UV set 1 on demand for aoMap
				if ( mapName === 'aoMap' && texture && ! texture.channel ) {

					texture.channel = 1;

				}

				if ( ! texture ) return;

				parser.associations.set( texture, { textures: mapDef.index } );

				materialParams[ mapName ] = texture;

			} );

		}

		/**
		 * Assigns final material to a Mesh, Line, or Points instance. The instance
		 * already has a material (generated from the glTF material options alone)
		 * but reuse of the same glTF material may require multiple threejs materials
		 * to accomodate different polygon modes, sides, etc. New materials will be
		 * created if necessary, and reused from a cache.
		 * @param  {Object3D} mesh Mesh, Line, or Points instance.
		 */
		_getNodeRef( cache, index, object ) {

			if ( cache.refs[ index ] <= 1 ) return object;

			const ref = object.clone();

			// Propagates mappings to the cloned object, prevents mappings on the
			// original object from being lost.
			const updateMappings = ( original, clone ) => {

				const mappings = this.associations.get( original );
				if ( mappings != null ) {

					this.associations.set( clone, mappings );

				}

				for ( const [ i, child ] of original.children.entries() ) {

					updateMappings( child, clone.children[ i ] );

				}

			};

			updateMappings( object, ref );

			ref.name += '_instance_' + ( cache.uses[ index ] ++ );

			return ref;

		}

	}

	/**
	 * @param {BufferGeometry} geometry
	 * @param {GLTF.Primitive} primitiveDef
	 * @param {GLTFParser} parser
	 * @return {Promise<BufferGeometry>}
	 */
	function addPrimitiveAttributes( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;

		const pending = [];

		function assignAttributeAccessor( accessorIndex, attributeName ) {

			return parser.getDependency( 'accessor', accessorIndex )
				.then( function ( accessor ) {

					geometry.setAttribute( attributeName, accessor );

				} );

		}

		for ( const gltfAttributeName in attributes ) {

			const threeAttributeName = ATTRIBUTES[ gltfAttributeName ] || gltfAttributeName.toLowerCase();

			// Skip attributes already provided by e.g. Draco extension.
			if ( threeAttributeName in geometry.attributes ) continue;

			pending.push( assignAttributeAccessor( attributes[ gltfAttributeName ], threeAttributeName ) );

		}

		if ( primitiveDef.indices !== undefined && ! geometry.index ) {

			const accessor = parser.getDependency( 'accessor', primitiveDef.indices ).then( function ( accessor ) {

				geometry.setIndex( accessor );

			} );

			pending.push( accessor );

		}

		assignExtrasToUserData( geometry, primitiveDef );

		computeBounds( geometry, primitiveDef, parser );

		return Promise.all( pending ).then( function () {

			return primitiveDef.targets !== undefined
				? addMorphTargets( geometry, primitiveDef.targets, parser )
				: geometry;

		} );

	}

	/**
	 * @param {BufferGeometry} geometry
	 * @param {Array<GLTF.Target>} targets
	 * @param {GLTFParser} parser
	 * @return {Promise<BufferGeometry>}
	 */
	function addMorphTargets( geometry, targets, parser ) {

		let hasMorphPosition = false;
		let hasMorphNormal = false;
		let hasMorphColor = false;

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];

			if ( target.POSITION !== undefined ) hasMorphPosition = true;
			if ( target.NORMAL !== undefined ) hasMorphNormal = true;
			if ( target.COLOR_0 !== undefined ) hasMorphColor = true;

			if ( hasMorphPosition && hasMorphNormal && hasMorphColor ) break;

		}

		if ( ! hasMorphPosition && ! hasMorphNormal && ! hasMorphColor ) return Promise.resolve( geometry );

		const pending = [];

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];

			if ( hasMorphPosition ) {

				const pendingAttribute = target.POSITION !== undefined
					? parser.getDependency( 'accessor', target.POSITION )
					: geometry.attributes.position;

				pending.push( pendingAttribute );

			}

			if ( hasMorphNormal ) {

				const pendingAttribute = target.NORMAL !== undefined
					? parser.getDependency( 'accessor', target.NORMAL )
					: geometry.attributes.normal;

				pending.push( pendingAttribute );

			}

			if ( hasMorphColor ) {

				const pendingAttribute = target.COLOR_0 !== undefined
					? parser.getDependency( 'accessor', target.COLOR_0 )
					: geometry.attributes.color;

				pending.push( pendingAttribute );

			}

		}

		return Promise.all( pending ).then( function ( accessors ) {

			const morphAttributes = geometry.morphAttributes;

			morphAttributes.position = [];
			morphAttributes.normal = [];
			morphAttributes.color = [];

			for ( let i = 0, il = targets.length; i < il; i ++ ) {

				const target = targets[ i ];
				const attributeIndex = i * 3;

				if ( hasMorphPosition ) {

					const position = accessors[ attributeIndex ];

					if ( target.POSITION !== undefined ) {

						morphAttributes.position.push( position );

					} else {

						// Copying the original position not available. Coule be external data, ...
						morphAttributes.position.push( geometry.attributes.position.clone() );

					}

				}

				if ( hasMorphNormal ) {

					const normal = accessors[ attributeIndex + 1 ];

					if ( target.NORMAL !== undefined ) {

						morphAttributes.normal.push( normal );

					} else {

						morphAttributes.normal.push( geometry.attributes.normal.clone() );

					}

				}

				if ( hasMorphColor ) {

					const color = accessors[ attributeIndex + 2 ];

					if ( target.COLOR_0 !== undefined ) {

						morphAttributes.color.push( color );

					} else {

						morphAttributes.color.push( geometry.attributes.color.clone() );

					}

				}

			}

			return geometry;

		} );

	}

	/**
	 * @param {Mesh} mesh
	 * @param {GLTF.Mesh} meshDef
	 */
	function updateMorphTargets( mesh, meshDef ) {

		mesh.updateMorphTargets();

		if ( meshDef.weights !== undefined ) {

			for ( let i = 0, il = meshDef.weights.length; i < il; i ++ ) {

				mesh.morphTargetInfluences[ i ] = meshDef.weights[ i ];

			}

		}

		// .extras has user-defined data, so check that .extras.targetNames is an array.
		if ( meshDef.extras && Array.isArray( meshDef.extras.targetNames ) ) {

			const targetNames = meshDef.extras.targetNames;

			if ( mesh.morphTargetInfluences.length === targetNames.length ) {

				mesh.morphTargetDictionary = {};

				for ( let i = 0, il = targetNames.length; i < il; i ++ ) {

					mesh.morphTargetDictionary[ targetNames[ i ] ] = i;

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.' );

			}

		}

	}

	function createPrimitiveKey( primitive ) {

		const dracoExtension = primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ];
		let geometryKey;

		if ( dracoExtension ) {

			geometryKey = 'draco:' + dracoExtension.bufferView
				+ ':' + dracoExtension.indices
				+ ':' + createAttributesKey( dracoExtension.attributes );

		} else {

			geometryKey = primitive.indices + ':' + createAttributesKey( primitive.attributes ) + ':' + primitive.mode;

		}

		return geometryKey;

	}

	function createAttributesKey( attributes ) {

		let attributesKey = '';

		const keys = Object.keys( attributes ).sort();

		for ( let i = 0, il = keys.length; i < il; i ++ ) {

			attributesKey += keys[ i ] + ':' + attributes[ keys[ i ] ] + ';';

		}

		return attributesKey;

	}

	function getNormalizedComponentScale( constructor ) {

		// Reference:
		// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data

		switch ( constructor ) {

			case Int8Array:
				return 1 / 127;

			case Uint8Array:
				return 1 / 255;

			case Int16Array:
				return 1 / 32767;

			case Uint16Array:
				return 1 / 65535;

			default:
				throw new Error( 'THREE.GLTFLoader: Unsupported normalized accessor component type.' );

		}

	}

	function getImageURIMimeType( uri ) {

		if ( uri.search( /\.jpe?g($|\?)/i ) > 0 || uri.search( /^data\:image\/jpeg/ ) === 0 ) return 'image/jpeg';
		if ( uri.search( /\.webp($|\?)/i ) > 0 || uri.search( /^data\:image\/webp/ ) === 0 ) return 'image/webp';

		return 'image/png';

	}

	/* GLTF PARSER UTILS */

	function resolveURL( url, path ) {

		// Invalid URL
		if ( typeof url !== 'string' || url === '' ) return '';

		// Host Relative URL
		if ( /^https?:\/\//i.test( path ) && /^\//.test( url ) ) {

			path = path.replace( /(^https?:\/\/[^\/]+).*/i, '$1' );

		}

		// Absolute URL http://,https://,//
		if ( /^(https?:)?\/\//i.test( url ) ) return url;

		// Data URI
		if ( /^data:.*,.*$/i.test( url ) ) return url;

		// Blob URL
		if ( /^blob:.*$/i.test( url ) ) return url;

		// Relative URL
		return path + url;

	}

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
	 */
	function createDefaultMaterial( cache ) {

		if ( cache.get( 'DefaultMaterial' ) === undefined ) {

			cache.add(
				'DefaultMaterial',
				new THREE.MeshStandardMaterial( {
					color: 0xFFFFFF,
					emissive: 0x000000,
					metalness: 1,
					roughness: 1,
					transparent: false,
					depthTest: true,
					side: THREE.FrontSide
				} )
			);

		}

		return cache.get( 'DefaultMaterial' );

	}

	function addUnknownExtensionsToUserData( knownExtensions, object, objectDef ) {

		// Add unknown glTF extensions to an object's userData.

		for ( const name in objectDef.extensions ) {

			if ( knownExtensions[ name ] === undefined ) {

				object.userData.gltfExtensions = object.userData.gltfExtensions || {};
				object.userData.gltfExtensions[ name ] = objectDef.extensions[ name ];

			}

		}

	}

	/**
	 * @param {Object3D|Material|BufferGeometry} object
	 * @param {GLTF.definition} gltfDef
	 */
	function assignExtrasToUserData( object, gltfDef ) {

		if ( gltfDef.extras !== undefined ) {

			if ( typeof gltfDef.extras === 'object' ) {

				Object.assign( object.userData, gltfDef.extras );

			} else {

				console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

			}

		}

	}

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
	 *
	 * @param {BufferGeometry} geometry
	 * @param {Array<GLTF.Target>} targets
	 * @param {GLTFParser} parser
	 * @return {Promise<BufferGeometry>}
	 */
	/**
	 * @param {BufferGeometry} geometry
	 * @param {GLTF.Primitive} primitiveDef
	 * @param {GLTFParser} parser
	 */
	function computeBounds( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;

		const box = new THREE.Box3();

		if ( attributes.POSITION !== undefined ) {

			const accessor = parser.json.accessors[ attributes.POSITION ];

			const min = accessor.min;
			const max = accessor.max;

			// glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

			if ( min !== undefined && max !== undefined ) {

				box.set(
					new THREE.Vector3( min[ 0 ], min[ 1 ], min[ 2 ] ),
					new THREE.Vector3( max[ 0 ], max[ 1 ], max[ 2 ] )
				);

				if ( accessor.normalized ) {

					const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
					box.min.multiplyScalar( boxScale );
					box.max.multiplyScalar( boxScale );

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

				return;

			}

		} else {

			return;

		}

		const targets = primitiveDef.targets;

		if ( targets !== undefined ) {

			const maxDisplacement = new THREE.Vector3();
			const vector = new THREE.Vector3();

			for ( let i = 0, il = targets.length; i < il; i ++ ) {

				const target = targets[ i ];

				if ( target.POSITION !== undefined ) {

					const accessor = parser.json.accessors[ target.POSITION ];
					const min = accessor.min;
					const max = accessor.max;

					// glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

					if ( min !== undefined && max !== undefined ) {

						// we need to get max of absolute components because target weight is [-1,1]
						vector.setX( Math.max( Math.abs( min[ 0 ] ), Math.abs( max[ 0 ] ) ) );
						vector.setY( Math.max( Math.abs( min[ 1 ] ), Math.abs( max[ 1 ] ) ) );
						vector.setZ( Math.max( Math.abs( min[ 2 ] ), Math.abs( max[ 2 ] ) ) );


						if ( accessor.normalized ) {

							const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
							vector.multiplyScalar( boxScale );

						}

						// Note: this assumes that the sum of all weights is at most 1. This isn't quite correct - it's more conservative
						// to assume that each target can have a max weight of 1. However, for some use cases - notably, when morph targets
						// are used to implement key-frame animations and as such only two are active at a time - this results in very large
						// boxes. So for now we make a box that's sometimes a touch too small but is hopefully mostly of reasonable size.
						maxDisplacement.max( vector );

					} else {

						console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

					}

				}

			}

			// As per comment above this box isn't conservative, but has a reasonable size for a very large number of morph targets.
			box.expandByVector( maxDisplacement );

		}

		geometry.boundingBox = box;

		const sphere = new THREE.Sphere();

		box.getCenter( sphere.center );
		sphere.radius = box.min.distanceTo( box.max ) / 2;

		geometry.boundingSphere = sphere;

	}

	/**
	 * @param {BufferGeometry} geometry
	 * @param {GLTF.Primitive} primitiveDef
	 * @param {GLTFParser} parser
	 * @return {Promise<BufferGeometry>}
	 */
	function buildNodeHierarchy( nodeId, parentObject, json, parser ) {

		const nodeDef = json.nodes[ nodeId ];

		return parser.getDependency( 'node', nodeId ).then( function ( node ) {

			if ( nodeDef.skin === undefined ) return node;

			// build skeleton here as well

			let skinEntry;

			return parser.getDependency( 'skin', nodeDef.skin ).then( function ( skin ) {

				skinEntry = skin;

				const pendingJoints = [];

				for ( let i = 0, il = skinEntry.joints.length; i < il; i ++ ) {

					pendingJoints.push( parser.getDependency( 'node', skinEntry.joints[ i ] ) );

				}

				return Promise.all( pendingJoints );

			} ).then( function ( jointNodes ) {

				node.traverse( function ( mesh ) {

					if ( ! mesh.isMesh ) return;

					const bones = [];
					const boneInverses = [];

					for ( let j = 0, jl = jointNodes.length; j < jl; j ++ ) {

						const jointNode = jointNodes[ j ];

						if ( jointNode ) {

							bones.push( jointNode );

							const mat = new THREE.Matrix4();

							if ( skinEntry.inverseBindMatrices !== undefined ) {

								mat.fromArray( skinEntry.inverseBindMatrices.array, j * 16 );

							}

							boneInverses.push( mat );

						} else {

							console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[ j ] );

						}

					}

					mesh.bind( new THREE.Skeleton( bones, boneInverses ), mesh.matrixWorld );

				} );

				return node;

			} );

		} ).then( function ( node ) {

			// build node hierachy

			parentObject.add( node );

			const pending = [];

			if ( nodeDef.children ) {

				const children = nodeDef.children;

				for ( let i = 0, il = children.length; i < il; i ++ ) {

					const child = children[ i ];
					pending.push( buildNodeHierarchy( child, node, json, parser ) );

				}

			}

			return Promise.all( pending );

		} );

	}

	/**
	 * @param {Object3D} node
	 * @param {GLTF.Node} nodeDef
	 */
	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
	 * @param {number} nodeIndex
	 * @return {Promise<Object3D>}
	 */
	/* CONSTANTS */

	const WEBGL_CONSTANTS = {
		FLOAT: 5126,
		//FLOAT_MAT2: 35674,
		FLOAT_MAT3: 35675,
		FLOAT_MAT4: 35676,
		FLOAT_VEC2: 35664,
		FLOAT_VEC3: 35665,
		FLOAT_VEC4: 35666,
		LINEAR: 9729,
		REPEAT: 10497,
		SAMPLER_2D: 35678,
		POINTS: 0,
		LINES: 1,
		LINE_LOOP: 2,
		LINE_STRIP: 3,
		TRIANGLES: 4,
		TRIANGLE_STRIP: 5,
		TRIANGLE_FAN: 6,
		UNSIGNED_BYTE: 5121,
		UNSIGNED_SHORT: 5123
	};

	const WEBGL_COMPONENT_TYPES = {
		5120: Int8Array,
		5121: Uint8Array,
		5122: Int16Array,
		5123: Uint16Array,
		5125: Uint32Array,
		5126: Float32Array
	};

	const WEBGL_FILTERS = {
		9728: THREE.NearestFilter,
		9729: THREE.LinearFilter,
		9984: THREE.NearestMipmapNearestFilter,
		9985: THREE.LinearMipmapNearestFilter,
		9986: THREE.NearestMipmapLinearFilter,
		9987: THREE.LinearMipmapLinearFilter
	};

	const WEBGL_WRAPPINGS = {
		33071: THREE.ClampToEdgeWrapping,
		33648: THREE.MirroredRepeatWrapping,
		10497: THREE.RepeatWrapping
	};

	const WEBGL_TYPE_SIZES = {
		'SCALAR': 1,
		'VEC2': 2,
		'VEC3': 3,
		'VEC4': 4,
		'MAT2': 4,
		'MAT3': 9,
		'MAT4': 16
	};

	const ATTRIBUTES = {
		POSITION: 'position',
		NORMAL: 'normal',
		TANGENT: 'tangent',
		TEXCOORD_0: 'uv',
		TEXCOORD_1: 'uv2',
		COLOR_0: 'color',
		WEIGHTS_0: 'skinWeight',
		JOINTS_0: 'skinIndex',
	};

	const PATH_PROPERTIES = {
		scale: 'scale',
		translation: 'position',
		rotation: 'quaternion',
		weights: 'morphTargetInfluences'
	};

	const INTERPOLATION = {
		CUBICSPLINE: undefined, // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
		                        // keyframe track will be initialized with a default interpolation type, then modified.
		LINEAR: THREE.InterpolateLinear,
		STEP: THREE.InterpolateDiscrete
	};

	const ALPHA_MODES = {
		OPAQUE: 'OPAQUE',
		MASK: 'MASK',
		BLEND: 'BLEND'
	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
	 */

	// ANIMATION


	/**
	 * A sub class of the Interpolant abstract class.
	 *
	 * This is identical to the default `Interpolant.InterpolantFactoryMethodLinear`, except that
	 * this interpolant sets T values at each keyframe to the  midpoint of adjacent keyframes.
	 *
	 * Time values are distributed this way in glTF CUBICSPLINE keyframe animations.
	 */
	class GLTFCubicSplineInterpolant extends THREE.Interpolant {

		copySampleValue_( index ) {

			// Copies a sample value to the result buffer. See description of glTF
			// CUBICSPLINE values layout in interpolate_() function below.

			const result = this.resultBuffer,
				values = this.sampleValues,
				valueSize = this.valueSize,
				offset = index * valueSize * 3 + valueSize;

			for ( let i = 0; i !== valueSize; i ++ ) {

				result[ i ] = values[ offset + i ];

			}

			return result;

		}

	}

	GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;
	GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

	GLTFCubicSplineInterpolant.prototype.interpolate_ = function ( i1, t0, t, t1 ) {

		const result = this.resultBuffer;
		const values = this.sampleValues;
		const stride = this.valueSize;

		const stride2 = stride * 2;
		const stride3 = stride * 3;

		const td = t1 - t0;

		const p = ( t - t0 ) / td;
		const pp = p * p;
		const ppp = pp * p;

		const offset1 = i1 * stride3;
		const offset0 = offset1 - stride3;

		const s0 = 2 * ppp - 3 * pp + 1;
		const s1 = ppp - 2 * pp + p;
		const s2 = - 2 * ppp + 3 * pp;
		const s3 = ppp - pp;

		// Layout of keyframe output values for CUBICSPLINE animations:
		//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]
		for ( let i = 0; i !== stride; i ++ ) {

			const p0 = values[ offset0 + i + stride ]; // splineVertex_k
			const m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)
			const p1 = values[ offset1 + i + stride ]; // splineVertex_k+1
			const m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

			result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

		}

		return result;

	};

	const _q = new THREE.Quaternion();

	class GLTFCubicSplineQuaternionInterpolant extends GLTFCubicSplineInterpolant {

		interpolate_( i1, t0, t, t1 ) {

			const result = super.interpolate_( i1, t0, t, t1 );

			_q.fromArray( result ).normalize().toArray( result );

			return result;

		}

	}


	/*********************************/
	/********** INTERNALS ************/
	/*********************************/

	/* CONSTANTS */

	const _taskCache = new WeakMap();

	THREE.GLTFLoader = GLTFLoader;

} )();






