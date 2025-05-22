const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

const ELEMENT_NAME_TRANSFER = {
  BODY: 'wiz-slide',
  'FUSION-GROUP': 'wiz-container',
  'FUSION-IMAGE': 'wiz-image',
  'FUSION-TEXT': 'wiz-text',
  'FUSION-BUTTON': 'wiz-button',
  'FUSION-POPUP': 'wiz-popup',
  'FUSION-CUSTOM-POPUP-OVERLAY': 'wiz-container',
  'FUSION-SHAPE': 'wiz-container',
  'FUSION-ACTION': 'wiz-action',
  'FUSION-VIDEO-PLAYER': 'wiz-video',
};
const WIZ_IMAGE = 'wiz-image';
const WIZ_ACTION = 'wiz-action';
const WIZ_TEXT = 'wiz-text';
const WIZ_POPUP = 'wiz-popup';
const FUSION_POPUP_OVERLAY = 'FUSION-CUSTOM-POPUP-OVERLAY';
const adv_slides_data = [];

function convertCSVFiles(csv_files, index) {
  if (index >= csv_files.length) {
    return;
  }
  const aa_csv_file = csv_files[index]['aa_csv_file'];
  const fusionElements = [];
  const popupElements = {};
  fs.createReadStream(aa_csv_file)
    .pipe(csv.parse({ headers: true, delimiter: '|' }))
    .on('data', (row) => {
      fusionElements.push(row);
      if (row.elementName === FUSION_POPUP_OVERLAY) {
        const popupId = row.parentId;
        popupElements[popupId] = {
          elementName: row.elementName,
          id: row.id,
          parentId: row.parentId,
          zIndex: row.zIndex || '',
          top: row.top || '',
          left: row.left || '',
          width: row.width || '',
          height: row.height || '',
          src: row.src || '',
          attributes: row.attributes || '',
          style: row.style || '',
          htmlContent: row.htmlContent || '',
        };
      }
    })
    .on('end', () => {
      generateEWCsvFile(fusionElements, popupElements, csv_files, index);
    });
}

function generateEWCsvFile(fusionElements, popupElements, csv_files, index) {
  const ew_csv_file = csv_files[index]['ew_csv_file'];
  const ewElements = [];
  for (
    let fusionEle_i = 0;
    fusionEle_i < fusionElements.length;
    fusionEle_i++
  ) {
    const fusionElement = fusionElements[fusionEle_i];
    const elementName = transferElementName(fusionElement.elementName);
    let elementId = fusionElement.id;
    let backgroundSrc = fusionElement.src || '';
    let style = fusionElement.style || '';
    let attributes = fusionElement.attributes || '';
    let zIndex = fusionElement.zIndex || '';

    if (backgroundSrc != '') {
      if (backgroundSrc.includes('shared/assets')) {
        backgroundSrc = backgroundSrc.replace(
          /shared\/assets\//,
          '../common/media/'
        );
      } else {
        backgroundSrc = backgroundSrc.replace(/assets\//, './media/');
      }
      if (elementName !== WIZ_IMAGE) {
        style = style.replace(/background-image: url\('([^']+)'\);/g, '');
      }
    }
    if (elementName === WIZ_TEXT) {
      if (zIndex !== '') {
        zIndex = (Number(zIndex) + 1).toString();
      }
      if (style.includes('z-index')) {
        style = style.replace(/z-index: (\d+);/, ` z-index: ${zIndex};`);
      } else {
        style = `${style} z-index: 1;`;
      }
    }
    if (elementName === WIZ_ACTION) {
      //on=""#LWHIJ9K3AZY6I""
      const elementId_regex = /on="#([^"]+)"/;
      const elementId_match = attributes.match(elementId_regex);
      if (elementId_match && elementId_match[1]) {
        elementId = elementId_match[1];
      }
      if (
        attributes.includes(`do="Toggle state"`) ||
        attributes.includes(`do="Apply state"`)
      ) {
        //state=""Popup-LYQ1E6O8LT7NE""
        const popup_id_regex = /state="Popup-([^"]+)"/;
        const popup_id_match = attributes.match(popup_id_regex);
        if (popup_id_match) {
          attributes = `v-open.popup.tap="'${popup_id_match[1]}'"`;
        }
      } else if (attributes.includes(`do="Set states"`)) {
        //state=""Popup-LV3JDUMZIMIFG Popup-LV3K3K6ICBZ3K""
        const popup_id_regex = /state="Popup-([^"]+)"/;
        const popup_id_match = attributes.match(popup_id_regex);
        if (popup_id_match) {
          attributes = `v-open.popup.tap="'${popup_id_match[1]}'"`;
        }
      } else if (
        attributes.includes(`do="Navigate"`) ||
        attributes.includes(`do="Previous slide"`) ||
        attributes.includes(`do="Next slide"`)
      ) {
        //binder=""202719""
        const binder_id_regex = /binder="([^"]+)"/;
        const binder_id_match = attributes.match(binder_id_regex);
        let binder_id = '';
        if (binder_id_match) {
          binder_id = binder_id_match[1];
        }
        //slide=""202743""
        const aa_slide_id_regex = /slide="([^"]+)"/;
        const aa_slide_id_match = attributes.match(aa_slide_id_regex);
        let aa_slide_id = '';
        if (aa_slide_id_match) {
          aa_slide_id = aa_slide_id_match[1];
        }
        const adv_folder = csv_files[index]['adv_folder'];
        const slide_folder = csv_files[index]['slide_folder'];
        let current_adv_slide_data = adv_slides_data.find((slide) => {
          return (
            slide['aa-binder-id'] === binder_id &&
            slide['aa-slide-id'] === aa_slide_id
          );
        });
        if (binder_id === '' && aa_slide_id !== '') {
          current_adv_slide_data = adv_slides_data.find((slide) => {
            return (
              slide['adv-folder'] === adv_folder &&
              slide['slide-folder'] === aa_slide_id
            );
          });
        }
        if (attributes.includes(`do="Previous slide"`)) {
          current_adv_slide_data = adv_slides_data.find((slide) => {
            return (
              slide['adv-folder'] === adv_folder &&
              slide['slide-folder'] === slide_folder
            );
          });
          const previousOrder =
            Number(current_adv_slide_data['slide-order']) - 1;
          const prev_adv_slide_data = adv_slides_data.find((slide) => {
            return (
              slide['adv-folder'] === adv_folder &&
              slide['slide-order'] === previousOrder.toString()
            );
          });

          // if (adv_folder === 'LRP_ONCO_ADV_FINAL_GL_EN') {
          //   console.log('JHPD - slide_folder - ', slide_folder);
          //   console.log('JHPD - binder_id - ', binder_id);
          //   console.log('JHPD - aa_slide_id - ', aa_slide_id);
          //   console.log('JHPD - current_adv_slide_data - ', JSON.stringify(current_adv_slide_data));
          //   console.log('JHPD - previousOrder - ', previousOrder);
          //   console.log('JHPD - prev_adv_slide_data - ', JSON.stringify(prev_adv_slide_data));
          //   return;
          // }
          if (prev_adv_slide_data) {
            current_adv_slide_data = prev_adv_slide_data;
          } else {
            console.error(
              `ERROR: Couldn't find the previous slide of slide "${slide_folder}" of adv "${adv_folder}"`
            );
          }
        } else if (attributes.includes(`do="Next slide"`)) {
          current_adv_slide_data = adv_slides_data.find((slide) => {
            return (
              slide['adv-folder'] === adv_folder &&
              slide['slide-folder'] === slide_folder
            );
          });
          const nextOrder = Number(current_adv_slide_data['slide-order']) + 1;
          const next_adv_slide_data = adv_slides_data.find((slide) => {
            return (
              slide['adv-folder'] === adv_folder &&
              slide['slide-order'] === nextOrder.toString()
            );
          });
          if (next_adv_slide_data) {
            current_adv_slide_data = next_adv_slide_data;
          } else {
            console.error(
              `ERROR: Couldn't find the next slide of slide "${slide_folder}" of adv "${adv_folder}"`
            );
          }
        }
        const chapter =
          (current_adv_slide_data && current_adv_slide_data['chapter']) || '';
        const slide_name =
          (current_adv_slide_data && current_adv_slide_data['slide-name']) ||
          '';
        attributes = `v-goto.tap="{'animation':true,'disabled':false,'slide':'${slide_name}','chapter':'${chapter}'}"`;
      } else if (attributes.includes(`do="Remove state"`)) {
        attributes = `NOT APPLICABLE IN EWIZARD`;
      } else {
        console.log('JHPD - attributes - ', attributes);
        attributes = `NOT IMPLEMENTED YET IN EWIZARD - CONTACT TRUESON TEAM`;
      }
      //v-open.pdf="";
    }
    let ewTop = fusionElement.top || '';
    let ewLeft = fusionElement.left || '';
    let ewWidth = fusionElement.width || '';
    let ewHeight = fusionElement.height || '';
    if (elementName === WIZ_POPUP) {
      const popupOverlay = popupElements[elementId];
      ewTop = popupOverlay.top;
      ewLeft = popupOverlay.left;
      ewWidth = popupOverlay.width;
      ewHeight = popupOverlay.height;
      if (backgroundSrc === '') {
        backgroundSrc = popupOverlay.src;
        if (backgroundSrc.includes('shared/assets')) {
          backgroundSrc = backgroundSrc.replace(
            /shared\/assets\//,
            '../common/media/'
          );
        } else {
          backgroundSrc = backgroundSrc.replace(/assets\//, './media/');
        }
      }
    }
    if (fusionElement.elementName === FUSION_POPUP_OVERLAY) {
      ewTop = '';
      ewLeft = '';
      ewWidth = '';
      ewHeight = '';
      style = style.replace(/ top: [-+]?\d+px;/, '');
      style = style.replace(/ left: [-+]?\d+px;/, '');
      style = style.replace(/ width: [-+]?\d+px;/, '');
      style = style.replace(/ height: [-+]?\d+px;/, '');
      style = '';
    }
    const ewElement = {
      elementName: elementName,
      id: elementId,
      parentId: fusionElement.parentId || '',
      zIndex: zIndex,
      top: ewTop,
      left: ewLeft,
      width: ewWidth,
      height: ewHeight,
      src: backgroundSrc,
      attributes: attributes,
      style: style,
      htmlContent: fusionElement.htmlContent || '',
    };
    ewElements.push(ewElement);
  }

  const csvStream = csv.format({ headers: true, delimiter: '|' });
  csvStream
    .pipe(fs.createWriteStream(ew_csv_file, { flags: 'a' }))
    .on('finish', () => {
      console.log(`CSV file of '${ew_csv_file}' created successfully.`);
    });

  for (let ewEle_i = 0; ewEle_i < ewElements.length; ewEle_i++) {
    csvStream.write(ewElements[ewEle_i]);
  }

  csvStream.end(); // Call end after writing all elements
  convertCSVFiles(csv_files, index + 1);
}

function transferElementName(elementName) {
  var wizElementName = elementName;
  if (ELEMENT_NAME_TRANSFER[elementName]) {
    wizElementName = ELEMENT_NAME_TRANSFER[elementName];
  }
  return wizElementName;
}

function combineAndGenerateEWCsvStructure() {
  const folders = fs.readdirSync(AA_ADVsFolder);
  const csv_files = [];
  for (let adv_folder_i = 0; adv_folder_i < folders.length; adv_folder_i++) {
    const adv_folder = folders[adv_folder_i];
    const currentADVFolderPath = path.join(AA_ADVsFolder, adv_folder);
    if (!fs.lstatSync(currentADVFolderPath).isDirectory()) {
      continue;
    }

    console.log(`Processing ADV: ${adv_folder}`);

    const outputAdvFolderPath = path.join(EW_csvStructureFolder, adv_folder);
    if (!fs.existsSync(outputAdvFolderPath)) {
      fs.mkdirSync(outputAdvFolderPath, { recursive: true });
      console.log(`Created ADV folder: ${outputAdvFolderPath}`);
    }

    const slide_folders = fs.readdirSync(currentADVFolderPath);

    for (
      let slide_folder_i = 0;
      slide_folder_i < slide_folders.length;
      slide_folder_i++
    ) {
      const slide_folder = slide_folders[slide_folder_i];
      const currentSlideFolderPath = path.join(
        currentADVFolderPath,
        slide_folder
      );
      if (!fs.lstatSync(currentSlideFolderPath).isDirectory()) {
        continue;
      }

      const outputSlideFolderPath = path.join(
        outputAdvFolderPath,
        slide_folder
      );
      if (!fs.existsSync(outputSlideFolderPath)) {
        fs.mkdirSync(outputSlideFolderPath, { recursive: true });
        console.log(`Created Slide folder: ${outputSlideFolderPath}`);
      }

      const currentAssetFolder = path.join(currentSlideFolderPath, 'assets');
      const outputMediaFolder = path.join(outputSlideFolderPath, 'media');
      if (fs.existsSync(currentAssetFolder)) {
        fs.cpSync(currentAssetFolder, outputMediaFolder, { recursive: true });
      }
      // JHPD - START - Need to develop - copy the assets from shared to media shared
      // END

      const aa_csv_file = path.join(
        AA_csvStructureFolder,
        adv_folder,
        `${slide_folder}.csv`
      );
      const ew_csv_file = path.join(
        EW_csvStructureFolder,
        adv_folder,
        slide_folder,
        `slide_structure.csv`
      );
      if (fs.existsSync(aa_csv_file)) {
        csv_files.push({
          adv_folder: adv_folder,
          slide_folder: slide_folder,
          aa_csv_file: aa_csv_file,
          ew_csv_file: ew_csv_file,
        });
      }
    }
  }

  convertCSVFiles(csv_files, 0);
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
}

function readADVStructureFile() {
  const advSlides = [];

  fs.createReadStream(ADV_Analysis_Path)
    .pipe(csv.parse({ headers: true }))
    .on('data', (row) => {
      advSlides.push(row);
    })
    .on('end', () => {
      for (let advSlide_i = 0; advSlide_i < advSlides.length; advSlide_i++) {
        const adv_slide_row = advSlides[advSlide_i];
        const adv_slide_data = {
          'adv-folder': adv_slide_row['ADV-name'],
          'slide-folder': adv_slide_row['Slide-name'],
          'aa-binder-id': adv_slide_row['aa-binder-id'] || '',
          'aa-slide-id': adv_slide_row['aa-slide-id'] || '',
          'slide-order': adv_slide_row['slide-order'] || '',
          'cloned-adv-name': adv_slide_row['cloned-adv-name'] || '',
          chapter: adv_slide_row['chapter'] || '',
          'slide-name': adv_slide_row['slide-name'] || '',
          'slide-data-asset-id': adv_slide_row['slide-data-asset-id'] || '',
          'slide-id': adv_slide_row['slide-id'] || '',
        };
        adv_slides_data.push(adv_slide_data);
      }
      combineAndGenerateEWCsvStructure(
        AA_csvStructureFolder,
        EW_csvStructureFolder
      );
    });
}

const AA_ADVsFolder = 'AA_ADVs';
const AA_csvStructureFolder = 'AA_csv_structures'; // Replace with the actual path to your folder
const EW_csvStructureFolder = 'EW_csv_structures';
const ADV_Analysis_Path = 'adv_analysis.csv';
deleteContents(EW_csvStructureFolder);
readADVStructureFile();
