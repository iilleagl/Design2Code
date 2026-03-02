/**
 * Pencil (.pen) to Sketch (.sketch) Converter
 * 将 Pencil 设计文件转换为 Sketch 文件格式
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 生成 UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

// 解析颜色值
function parseColor(colorValue, variables = {}, theme = {}) {
  if (!colorValue) return { _class: 'color', red: 0, green: 0, blue: 0, alpha: 1 };
  
  let color = colorValue;
  
  // 如果是变量引用
  if (typeof color === 'string' && color.startsWith('$')) {
    const varName = color.slice(1);
    const variable = variables[varName];
    if (variable) {
      if (Array.isArray(variable.value)) {
        // 查找匹配主题的值
        const themeValue = variable.value.find(v => {
          if (!v.theme) return false;
          return Object.entries(v.theme).every(([key, val]) => theme[key] === val);
        });
        color = themeValue ? themeValue.value : variable.value[0].value;
      } else {
        color = variable.value;
      }
    }
  }
  
  // 解析 HEX 颜色
  if (typeof color === 'string' && color.startsWith('#')) {
    const hex = color.slice(1);
    let r, g, b, a = 1;
    
    if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
    } else if (hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
      a = parseInt(hex.slice(6, 8), 16) / 255;
    } else if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    }
    
    return { _class: 'color', red: r || 0, green: g || 0, blue: b || 0, alpha: a };
  }
  
  return { _class: 'color', red: 0, green: 0, blue: 0, alpha: 1 };
}

// 解析数值变量
function parseNumberValue(value, variables = {}) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.startsWith('$')) {
    const varName = value.slice(1);
    const variable = variables[varName];
    if (variable && typeof variable.value === 'number') {
      return variable.value;
    }
  }
  return 0;
}

// 解析宽度/高度值
function parseDimension(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // 处理 "fill_container(360)" 格式
    const match = value.match(/fill_container\((\d+)\)/);
    if (match) return parseInt(match[1], 10);
  }
  return 100; // 默认值
}

// 创建 Sketch 填充样式
function createFill(fillValue, variables, theme) {
  if (!fillValue) return null;
  
  const color = parseColor(fillValue, variables, theme);
  
  return {
    _class: 'fill',
    isEnabled: true,
    fillType: 0, // 0 = solid color
    color: color,
    contextSettings: {
      _class: 'graphicsContextSettings',
      blendMode: 0,
      opacity: 1
    },
    gradient: {
      _class: 'gradient',
      elipseLength: 0,
      from: '{0.5, 0}',
      to: '{0.5, 1}',
      gradientType: 0,
      stops: []
    },
    noiseIndex: 0,
    noiseIntensity: 0,
    patternFillType: 0,
    patternTileScale: 1
  };
}

// 创建 Sketch 边框样式
function createBorder(strokeValue, variables, theme) {
  if (!strokeValue || !strokeValue.fill) return null;
  
  const color = parseColor(strokeValue.fill, variables, theme);
  
  return {
    _class: 'border',
    isEnabled: true,
    fillType: 0,
    color: color,
    position: strokeValue.align === 'inside' ? 1 : (strokeValue.align === 'outside' ? 2 : 0),
    thickness: strokeValue.thickness || 1,
    contextSettings: {
      _class: 'graphicsContextSettings',
      blendMode: 0,
      opacity: 1
    },
    gradient: {
      _class: 'gradient',
      elipseLength: 0,
      from: '{0.5, 0}',
      to: '{0.5, 1}',
      gradientType: 0,
      stops: []
    }
  };
}

// 创建 Sketch 阴影样式
function createShadow(effect, variables, theme) {
  if (!effect || effect.type !== 'shadow') return null;
  
  const color = parseColor(effect.color, variables, theme);
  const isInner = effect.shadowType === 'inner';
  
  return {
    _class: isInner ? 'innerShadow' : 'shadow',
    isEnabled: true,
    blurRadius: effect.blur || 0,
    color: color,
    contextSettings: {
      _class: 'graphicsContextSettings',
      blendMode: 0,
      opacity: 1
    },
    offsetX: effect.offset?.x || 0,
    offsetY: effect.offset?.y || 0,
    spread: effect.spread || 0
  };
}

// 创建基础图层属性
function createBaseLayer(element, width, height) {
  const uuid = generateUUID();
  
  return {
    do_objectID: uuid,
    booleanOperation: -1,
    isFixedToViewport: false,
    isFlippedHorizontal: false,
    isFlippedVertical: false,
    isLocked: false,
    isVisible: true,
    layerListExpandedType: 0,
    name: element.name || 'Layer',
    nameIsFixed: false,
    resizingConstraint: 63,
    resizingType: 0,
    rotation: 0,
    shouldBreakMaskChain: false,
    exportOptions: {
      _class: 'exportOptions',
      includedLayerIds: [],
      layerOptions: 0,
      shouldTrim: false,
      exportFormats: []
    },
    frame: {
      _class: 'rect',
      constrainProportions: false,
      height: height,
      width: width,
      x: element.x || 0,
      y: element.y || 0
    },
    clippingMaskMode: 0,
    hasClippingMask: false
  };
}

// 创建默认样式
function createDefaultStyle() {
  return {
    _class: 'style',
    do_objectID: generateUUID(),
    endMarkerType: 0,
    miterLimit: 10,
    startMarkerType: 0,
    windingRule: 1,
    blur: {
      _class: 'blur',
      isEnabled: false,
      center: '{0.5, 0.5}',
      motionAngle: 0,
      radius: 10,
      saturation: 1,
      type: 0
    },
    borderOptions: {
      _class: 'borderOptions',
      isEnabled: true,
      dashPattern: [],
      lineCapStyle: 0,
      lineJoinStyle: 0
    },
    borders: [],
    colorControls: {
      _class: 'colorControls',
      isEnabled: false,
      brightness: 0,
      contrast: 1,
      hue: 0,
      saturation: 1
    },
    contextSettings: {
      _class: 'graphicsContextSettings',
      blendMode: 0,
      opacity: 1
    },
    fills: [],
    innerShadows: [],
    shadows: []
  };
}

// 转换文本元素
function convertText(element, variables, theme) {
  const width = parseDimension(element.width) || 200;
  const height = parseDimension(element.height) || 24;
  
  const layer = {
    ...createBaseLayer(element, width, height),
    _class: 'text',
    automaticallyDrawOnUnderlyingPath: false,
    dontSynchroniseWithSymbol: false,
    glyphBounds: `{{0, 0}, {${width}, ${height}}}`,
    lineSpacingBehaviour: 2,
    textBehaviour: 0,
    attributedString: {
      _class: 'attributedString',
      string: element.content || '',
      attributes: [{
        _class: 'stringAttribute',
        location: 0,
        length: (element.content || '').length,
        attributes: {
          MSAttributedStringFontAttribute: {
            _class: 'fontDescriptor',
            attributes: {
              name: element.fontFamily?.replace('$', '') || 'Helvetica',
              size: element.fontSize || 14
            }
          },
          MSAttributedStringColorAttribute: parseColor(element.fill, variables, theme),
          textStyleVerticalAlignmentKey: 0,
          paragraphStyle: {
            _class: 'paragraphStyle',
            alignment: 0,
            maximumLineHeight: (element.fontSize || 14) * (element.lineHeight || 1.4),
            minimumLineHeight: (element.fontSize || 14) * (element.lineHeight || 1.4)
          }
        }
      }]
    },
    style: createDefaultStyle()
  };
  
  return layer;
}

// 转换矩形元素
function convertRectangle(element, variables, theme) {
  const width = parseDimension(element.width) || 100;
  const height = parseDimension(element.height) || 100;
  const cornerRadius = parseNumberValue(element.cornerRadius, variables);
  
  const style = createDefaultStyle();
  
  // 添加填充
  if (element.fill) {
    const fill = createFill(element.fill, variables, theme);
    if (fill) style.fills.push(fill);
  }
  
  // 添加边框
  if (element.stroke?.fill) {
    const border = createBorder(element.stroke, variables, theme);
    if (border) style.borders.push(border);
  }
  
  // 添加阴影
  if (element.effect) {
    const shadow = createShadow(element.effect, variables, theme);
    if (shadow) {
      if (element.effect.shadowType === 'inner') {
        style.innerShadows.push(shadow);
      } else {
        style.shadows.push(shadow);
      }
    }
  }
  
  const layer = {
    ...createBaseLayer(element, width, height),
    _class: 'rectangle',
    edited: false,
    isClosed: true,
    pointRadiusBehaviour: 1,
    points: [
      {
        _class: 'curvePoint',
        cornerRadius: cornerRadius,
        curveFrom: '{0, 0}',
        curveMode: 1,
        curveTo: '{0, 0}',
        hasCurveFrom: false,
        hasCurveTo: false,
        point: '{0, 0}'
      },
      {
        _class: 'curvePoint',
        cornerRadius: cornerRadius,
        curveFrom: '{1, 0}',
        curveMode: 1,
        curveTo: '{1, 0}',
        hasCurveFrom: false,
        hasCurveTo: false,
        point: '{1, 0}'
      },
      {
        _class: 'curvePoint',
        cornerRadius: cornerRadius,
        curveFrom: '{1, 1}',
        curveMode: 1,
        curveTo: '{1, 1}',
        hasCurveFrom: false,
        hasCurveTo: false,
        point: '{1, 1}'
      },
      {
        _class: 'curvePoint',
        cornerRadius: cornerRadius,
        curveFrom: '{0, 1}',
        curveMode: 1,
        curveTo: '{0, 1}',
        hasCurveFrom: false,
        hasCurveTo: false,
        point: '{0, 1}'
      }
    ],
    fixedRadius: cornerRadius,
    needsConvertionToNewRoundCorners: false,
    hasConvertedToNewRoundCorners: true,
    style: style
  };
  
  return layer;
}

// 转换 frame 元素（作为 group 或 artboard）
function convertFrame(element, variables, theme, isTopLevel = false) {
  const width = parseDimension(element.width) || 100;
  const height = parseDimension(element.height) || 100;
  const cornerRadius = parseNumberValue(element.cornerRadius, variables);
  
  const style = createDefaultStyle();
  
  // 添加填充
  if (element.fill) {
    const fill = createFill(element.fill, variables, theme);
    if (fill) style.fills.push(fill);
  }
  
  // 添加边框
  if (element.stroke?.fill) {
    const border = createBorder(element.stroke, variables, theme);
    if (border) style.borders.push(border);
  }
  
  // 添加阴影
  if (element.effect) {
    const shadow = createShadow(element.effect, variables, theme);
    if (shadow) {
      if (element.effect.shadowType === 'inner') {
        style.innerShadows.push(shadow);
      } else {
        style.shadows.push(shadow);
      }
    }
  }
  
  // 转换子元素
  const children = (element.children || []).map(child => 
    convertElement(child, variables, element.theme || theme)
  ).filter(Boolean);
  
  if (isTopLevel) {
    // 顶级 frame 作为 artboard
    return {
      ...createBaseLayer(element, width, height),
      _class: 'artboard',
      hasBackgroundColor: !!element.fill,
      backgroundColor: element.fill ? parseColor(element.fill, variables, theme) : { _class: 'color', red: 1, green: 1, blue: 1, alpha: 1 },
      includeBackgroundColorInExport: true,
      includeInCloudUpload: true,
      isFlowHome: false,
      resizesContent: false,
      hasClickThrough: true,
      layers: children,
      style: style
    };
  } else {
    // 嵌套 frame 作为 group（带背景矩形）
    const groupLayers = [];
    
    // 如果有背景色，添加背景矩形
    if (element.fill) {
      const bgRect = {
        ...createBaseLayer({ name: 'Background', x: 0, y: 0 }, width, height),
        _class: 'rectangle',
        edited: false,
        isClosed: true,
        pointRadiusBehaviour: 1,
        points: [
          { _class: 'curvePoint', cornerRadius: cornerRadius, curveFrom: '{0, 0}', curveMode: 1, curveTo: '{0, 0}', hasCurveFrom: false, hasCurveTo: false, point: '{0, 0}' },
          { _class: 'curvePoint', cornerRadius: cornerRadius, curveFrom: '{1, 0}', curveMode: 1, curveTo: '{1, 0}', hasCurveFrom: false, hasCurveTo: false, point: '{1, 0}' },
          { _class: 'curvePoint', cornerRadius: cornerRadius, curveFrom: '{1, 1}', curveMode: 1, curveTo: '{1, 1}', hasCurveFrom: false, hasCurveTo: false, point: '{1, 1}' },
          { _class: 'curvePoint', cornerRadius: cornerRadius, curveFrom: '{0, 1}', curveMode: 1, curveTo: '{0, 1}', hasCurveFrom: false, hasCurveTo: false, point: '{0, 1}' }
        ],
        fixedRadius: cornerRadius,
        needsConvertionToNewRoundCorners: false,
        hasConvertedToNewRoundCorners: true,
        style: style
      };
      groupLayers.push(bgRect);
    }
    
    groupLayers.push(...children);
    
    return {
      ...createBaseLayer(element, width, height),
      _class: 'group',
      hasClickThrough: false,
      layers: groupLayers,
      style: createDefaultStyle()
    };
  }
}

// 转换椭圆元素
function convertOval(element, variables, theme) {
  const width = parseDimension(element.width) || 100;
  const height = parseDimension(element.height) || 100;
  
  const style = createDefaultStyle();
  
  if (element.fill) {
    const fill = createFill(element.fill, variables, theme);
    if (fill) style.fills.push(fill);
  }
  
  if (element.stroke?.fill) {
    const border = createBorder(element.stroke, variables, theme);
    if (border) style.borders.push(border);
  }
  
  return {
    ...createBaseLayer(element, width, height),
    _class: 'oval',
    edited: false,
    isClosed: true,
    pointRadiusBehaviour: 1,
    points: [
      { _class: 'curvePoint', cornerRadius: 0, curveFrom: '{0.77614237490000004, 1}', curveMode: 2, curveTo: '{0.22385762510000001, 1}', hasCurveFrom: true, hasCurveTo: true, point: '{0.5, 1}' },
      { _class: 'curvePoint', cornerRadius: 0, curveFrom: '{1, 0.22385762510000001}', curveMode: 2, curveTo: '{1, 0.77614237490000004}', hasCurveFrom: true, hasCurveTo: true, point: '{1, 0.5}' },
      { _class: 'curvePoint', cornerRadius: 0, curveFrom: '{0.22385762510000001, 0}', curveMode: 2, curveTo: '{0.77614237490000004, 0}', hasCurveFrom: true, hasCurveTo: true, point: '{0.5, 0}' },
      { _class: 'curvePoint', cornerRadius: 0, curveFrom: '{0, 0.77614237490000004}', curveMode: 2, curveTo: '{0, 0.22385762510000001}', hasCurveFrom: true, hasCurveTo: true, point: '{0, 0.5}' }
    ],
    style: style
  };
}

// 转换路径元素
function convertPath(element, variables, theme) {
  const width = parseDimension(element.width) || 100;
  const height = parseDimension(element.height) || 100;
  
  const style = createDefaultStyle();
  
  if (element.fill) {
    const fill = createFill(element.fill, variables, theme);
    if (fill) style.fills.push(fill);
  }
  
  if (element.stroke?.fill) {
    const border = createBorder(element.stroke, variables, theme);
    if (border) style.borders.push(border);
  }
  
  // 简化处理：将路径作为矩形
  return {
    ...createBaseLayer(element, width, height),
    _class: 'shapePath',
    edited: true,
    isClosed: element.closed !== false,
    pointRadiusBehaviour: 1,
    points: [],
    style: style
  };
}

// 转换单个元素
function convertElement(element, variables, theme = {}) {
  if (!element) return null;
  
  // 合并元素主题
  const mergedTheme = { ...theme, ...(element.theme || {}) };
  
  switch (element.type) {
    case 'frame':
      return convertFrame(element, variables, mergedTheme, false);
    case 'text':
      return convertText(element, variables, mergedTheme);
    case 'rectangle':
      return convertRectangle(element, variables, mergedTheme);
    case 'oval':
    case 'ellipse':
    case 'circle':
      return convertOval(element, variables, mergedTheme);
    case 'path':
    case 'vector':
      return convertPath(element, variables, mergedTheme);
    case 'ref':
      // 引用元素，简化处理为占位符
      return {
        ...createBaseLayer({ name: element.ref || 'Reference', x: element.x || 0, y: element.y || 0 }, 50, 50),
        _class: 'group',
        layers: [],
        style: createDefaultStyle()
      };
    default:
      console.log(`未知元素类型: ${element.type}`);
      return null;
  }
}

// 提取变量
function extractVariables(penData) {
  const variables = {};
  
  for (const [key, value] of Object.entries(penData)) {
    if (key.startsWith('--')) {
      variables[key] = value;
    }
  }
  
  return variables;
}

// 创建 Sketch 文档结构
function createSketchDocument(penData) {
  const variables = extractVariables(penData);
  const pageId = generateUUID();
  const documentId = generateUUID();
  
  // 转换顶级 frame 为 artboard
  const artboards = (penData.children || [])
    .filter(child => child.type === 'frame')
    .map(frame => convertFrame(frame, variables, frame.theme || {}, true))
    .filter(Boolean);
  
  // 创建页面
  const page = {
    _class: 'page',
    do_objectID: pageId,
    booleanOperation: -1,
    isFixedToViewport: false,
    isFlippedHorizontal: false,
    isFlippedVertical: false,
    isLocked: false,
    isVisible: true,
    layerListExpandedType: 0,
    name: 'Page 1',
    nameIsFixed: false,
    resizingConstraint: 63,
    resizingType: 0,
    rotation: 0,
    shouldBreakMaskChain: false,
    exportOptions: {
      _class: 'exportOptions',
      includedLayerIds: [],
      layerOptions: 0,
      shouldTrim: false,
      exportFormats: []
    },
    frame: {
      _class: 'rect',
      constrainProportions: false,
      height: 10000,
      width: 10000,
      x: 0,
      y: 0
    },
    clippingMaskMode: 0,
    hasClippingMask: false,
    hasClickThrough: true,
    layers: artboards,
    style: createDefaultStyle()
  };
  
  // 创建文档
  const document = {
    _class: 'document',
    do_objectID: documentId,
    assets: {
      _class: 'assetCollection',
      do_objectID: generateUUID(),
      colorAssets: [],
      colors: [],
      gradientAssets: [],
      gradients: [],
      imageCollection: {
        _class: 'imageCollection',
        images: {}
      },
      images: []
    },
    colorSpace: 0,
    currentPageIndex: 0,
    foreignLayerStyles: [],
    foreignSymbols: [],
    foreignTextStyles: [],
    layerStyles: {
      _class: 'sharedStyleContainer',
      do_objectID: generateUUID(),
      objects: []
    },
    layerSymbols: {
      _class: 'symbolContainer',
      do_objectID: generateUUID(),
      objects: []
    },
    layerTextStyles: {
      _class: 'sharedTextStyleContainer',
      do_objectID: generateUUID(),
      objects: []
    },
    pages: [{
      _class: 'MSJSONFileReference',
      _ref_class: 'MSImmutablePage',
      _ref: `pages/${pageId}`
    }]
  };
  
  // 创建元数据
  const meta = {
    commit: 'unknown',
    pagesAndArtboards: {
      [pageId]: {
        name: 'Page 1',
        artboards: artboards.reduce((acc, artboard) => {
          acc[artboard.do_objectID] = { name: artboard.name };
          return acc;
        }, {})
      }
    },
    version: 136,
    fonts: [],
    compatibilityVersion: 99,
    app: 'com.bohemiancoding.sketch3',
    autosaved: 0,
    variant: 'NONAPPSTORE',
    created: {
      commit: 'unknown',
      appVersion: '70',
      build: 0,
      app: 'com.bohemiancoding.sketch3',
      compatibilityVersion: 99,
      version: 136,
      variant: 'NONAPPSTORE'
    },
    saveHistory: ['NONAPPSTORE.0'],
    appVersion: '70',
    build: 0
  };
  
  // 创建用户数据
  const user = {
    [pageId]: {
      scrollOrigin: '{0, 0}',
      zoomValue: 1
    },
    [documentId]: {
      pageListHeight: 100,
      cloudShare: null
    }
  };
  
  return {
    document,
    meta,
    user,
    pages: {
      [pageId]: page
    }
  };
}

// 主函数：转换并保存
async function convertPenToSketch(inputPath, outputPath) {
  console.log(`读取文件: ${inputPath}`);
  
  // 读取 .pen 文件
  const penContent = fs.readFileSync(inputPath, 'utf-8');
  const penData = JSON.parse(penContent);
  
  console.log(`文件版本: ${penData.version}`);
  console.log(`顶级元素数量: ${penData.children?.length || 0}`);
  
  // 转换为 Sketch 结构
  const sketchData = createSketchDocument(penData);
  
  // 创建临时目录
  const tempDir = path.join(path.dirname(outputPath), '.sketch-temp');
  const pagesDir = path.join(tempDir, 'pages');
  
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(pagesDir, { recursive: true });
  
  // 写入文件
  fs.writeFileSync(
    path.join(tempDir, 'document.json'),
    JSON.stringify(sketchData.document, null, 2)
  );
  fs.writeFileSync(
    path.join(tempDir, 'meta.json'),
    JSON.stringify(sketchData.meta, null, 2)
  );
  fs.writeFileSync(
    path.join(tempDir, 'user.json'),
    JSON.stringify(sketchData.user, null, 2)
  );
  
  // 写入页面
  for (const [pageId, page] of Object.entries(sketchData.pages)) {
    fs.writeFileSync(
      path.join(pagesDir, `${pageId}.json`),
      JSON.stringify(page, null, 2)
    );
  }
  
  console.log('创建 Sketch 文件...');
  
  // 创建 zip 文件
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`Sketch 文件已创建: ${outputPath}`);
      console.log(`文件大小: ${archive.pointer()} bytes`);
      resolve();
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // 添加文件到 zip
    archive.file(path.join(tempDir, 'document.json'), { name: 'document.json' });
    archive.file(path.join(tempDir, 'meta.json'), { name: 'meta.json' });
    archive.file(path.join(tempDir, 'user.json'), { name: 'user.json' });
    archive.directory(pagesDir, 'pages');
    
    archive.finalize();
  });
  
  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true });
  
  console.log('转换完成!');
}

// 运行转换
const inputFile = process.argv[2] || './pencil-welcome.pen';
const outputFile = process.argv[3] || inputFile.replace('.pen', '.sketch');

convertPenToSketch(inputFile, outputFile).catch(console.error);
