const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const csv = require('fast-csv');
const FUSION_LIST = [
  'body',
  'article',
  'fusion-group',
  'fusion-text',
  'fusion-image',
  'fusion-button',
  'fusion-shape',
  'fusion-action',
  'fusion-popup',
  'fusion-custom-popup-overlay',
  'fusion-video-player'
];
const IGNORE_HTML_CONTENT_LOST = [
  'body',
  'article'
]
const ATTRIBUTE_LIST = [
  "position",
  "opacity",
  "ratio",
  "background-color",
  "background-image",
  "background-size",
  "background-position-x",
  "background-position-y",
  "background-repeat",
  "background-attachment",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "color",
  "direction",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "object-fit",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "transform"
];
const SECOND_LAYER_ATTRIBUTE_LIST = [
  "top",
  "left",
  "height",
  "width"
];
function extractFusionElements(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const slideId = $('article').attr('id');
  const fusionElements = [];
  for (var fusionTagNameIndex in FUSION_LIST) {   
    const fusionTagName = FUSION_LIST[fusionTagNameIndex];
    $(fusionTagName).each((index, element) => {
      const $element = $(element);
      var attributesText = '';
      var propStyle = '';
      var elementStyle = $element.attr('style') || '';
      var backgroundSrc = $element.attr('src') || '';
      var attributeKeys = Object.keys($element.attr());
      for (let attr_i = 0; attr_i < attributeKeys.length; attr_i++) {
        const attr = attributeKeys[attr_i];
        attributesText = `${attributesText} ${attr}="${$element.attr(attr)}"`;
        if (ATTRIBUTE_LIST.includes(attr) && $element.attr(attr) && $element.attr(attr) !== '') {
          if (attr === 'background-image') {
            propStyle = `${propStyle} ${attr}: '${$element.attr(attr)}';`;
          } else {
            propStyle = `${propStyle} ${attr}: ${$element.attr(attr)};`;
          }
        }
        if (SECOND_LAYER_ATTRIBUTE_LIST.includes(attr) && !elementStyle.includes(attr)) {
          propStyle = `${propStyle} ${attr}: ${$element.attr(attr)};`;
        }
      };
      var parentId = '';
      if ($element.parent().prop('id') && $element.parent().prop('id') !== slideId) {
        parentId = $element.parent().prop('id');
      }
      if ($element.attr('style')) {
        propStyle = propStyle + $element.attr('style');
        if ($element.css('background-image')) {
          backgroundSrc = $element.css('background-image').replace(/url\('([^']+)'\)/, '$1');
        }
      }
      // if (backgroundSrc !== '') {
      //   backgroundSrc = backgroundSrc.replace(/assets\//, 'media/');
      // }
      var currentEleHtmlContent = '';
      if (!IGNORE_HTML_CONTENT_LOST.includes(fusionTagName)) {
        currentEleHtmlContent = $element.html().replace(/\|/g, '&#124;');
      } 
      const fusionElement = {
        elementName: $element.prop('nodeName'),
        id: $element.prop('id'),
        parentId: parentId, // Check if parent is the slide
        zIndex: $element.css('z-index') || '',
        top: $element.attr('top') || '',
        left: $element.attr('left') || '',
        width: $element.attr('width') || '',
        height: $element.attr('height') || '',
        src: backgroundSrc,
        attributes: attributesText,
        style: propStyle || '',
        htmlContent: currentEleHtmlContent,
      };
      fusionElements.push(fusionElement);
    });

  }
  return fusionElements;
}


function readHTMLFilesInFolders(folderPath) {
  const folders = fs.readdirSync(folderPath);

  for (let adv_folder_i = 0; adv_folder_i < folders.length; adv_folder_i++) {
    const adv_folder = folders[adv_folder_i];
    const adv_name = adv_folder;
    const currentADVFolderPath = path.join(folderPath, adv_folder);
    if (!fs.lstatSync(currentADVFolderPath).isDirectory()) {
      continue;
    }

    console.log(`Processing ADV: ${adv_name}`);
    
    const outputAdvFolderPath = path.join(AA_csvStructureFolder, adv_folder);
    if (!fs.existsSync(outputAdvFolderPath)) {
      fs.mkdirSync(outputAdvFolderPath, { recursive: true });
      console.log(`Created ADV folder: ${outputAdvFolderPath}`);
    }

    const slide_folders = fs.readdirSync(currentADVFolderPath);

    for (let slide_folder_i = 0; slide_folder_i < slide_folders.length; slide_folder_i++) {
      const slide_folder = slide_folders[slide_folder_i];
      const currentSlideFolderPath = path.join(currentADVFolderPath, slide_folder);
      if (!fs.lstatSync(currentSlideFolderPath).isDirectory()) {
        continue;
      }
      const files = fs.readdirSync(currentSlideFolderPath);
      processFiles(files, currentSlideFolderPath, outputAdvFolderPath, slide_folder);
    };
  };
}

function processFiles(files, currentSlideFolderPath, outputAdvFolderPath, slide_folder, index = 0) {
  if (index >= files.length) {
    return; // End of files
  }

  const file = files[index];
  const filePath = path.join(currentSlideFolderPath, file);

  if (path.extname(filePath) !== '.html') {
    processFiles(files, currentSlideFolderPath, outputAdvFolderPath, slide_folder, index + 1);
    return;
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', filePath, err);
      processFiles(files, currentSlideFolderPath, outputAdvFolderPath, slide_folder, index + 1);
      return;
    }

    const fusionElements = extractFusionElements(data);
    console.log(`Processing file: ${filePath}`);
    const outputCsvPath = path.join(outputAdvFolderPath, `${slide_folder}.csv`);

    const csvStream = csv.format({ headers: true, delimiter: '|' });
    csvStream.pipe(fs.createWriteStream(outputCsvPath, { flags: 'a' })).on('finish', () => {
      console.log(`CSV file of '${slide_folder}' created successfully.`);
    });

    fusionElements.forEach(element => {
      csvStream.write(element);
    });

    csvStream.end(); // Call end after writing all elements

    // Process the next file
    processFiles(files, currentSlideFolderPath, outputAdvFolderPath, slide_folder, index + 1);
  });
}

function deleteContents(folderPath) {
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(folderPath, files[i]);
      if (fs.lstatSync(filePath).isDirectory()) {
        deleteContents(filePath); // Recursively delete contents of subdirectory
        fs.rmdirSync(filePath); // Remove empty directory
      } else {
        fs.unlinkSync(filePath); // Delete file
      }
    }
  }
  return true;
}

const AA_slidesFolder = 'AA_ADVs'; // Replace with the actual path to your folder
const AA_csvStructureFolder = 'AA_csv_structures';
deleteContents(AA_csvStructureFolder);
readHTMLFilesInFolders(AA_slidesFolder);