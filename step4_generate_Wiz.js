const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

const EWIZARD_SLIDE_ELEMENT = 'wiz-slide';
const EWIZARD_TEXT_ELEMENT = 'wiz-text';
const EWIZARD_IMAGE_ELEMENT = 'wiz-image';
const EWIZARD_POPUP_ELEMENT = 'wiz-popup';
const EWIZARD_BUTTON_ELEMENT = 'wiz-button';
const EWIZARD_ACTION_ELEMENT = 'wiz-action';
const EWIZARD_VIDEO_ELEMENT = 'wiz-video';
const EXCLUDED_ELEMENTS = ['wiz-slide', 'wiz-action', 'ARTICLE'];

function startGeneratingWiz(
  adv_folders,
  json_structures,
  adv_slide_folders,
  index
) {
  if (index >= adv_slide_folders.length) {
    return;
  }
  const adv_folder = adv_slide_folders[index]['adv-folder'];
  const slide_folder = adv_slide_folders[index]['slide-folder'];
  const slide_structure_file = path.join(
    CSV_STRUCTURE_FOLDER,
    adv_folder,
    slide_folder,
    'slide_structure.csv'
  );
  const ewizardElements = [];
  const wizActions = {};
  fs.createReadStream(slide_structure_file)
    .pipe(csv.parse({ headers: true, delimiter: '|' }))
    .on('data', (row) => {
      ewizardElements.push(row);
      if (row.elementName === EWIZARD_ACTION_ELEMENT) {
        wizActions[row.id] = row.attributes;
      }
    })
    .on('end', () => {
      generateVueFile(
        ewizardElements,
        wizActions,
        adv_folders,
        json_structures,
        adv_slide_folders,
        index
      );
    });
}

function generateVueFile(
  ewizardElements,
  wizActions,
  adv_folders,
  json_structures,
  adv_slide_folders,
  index
) {
  const adv_folder = adv_slide_folders[index]['adv-folder'];
  const slide_folder = adv_slide_folders[index]['slide-folder'];
  let vue_slide_folder = slide_folder;
  if (
    adv_slide_folders[index]['slide-name'] &&
    adv_slide_folders[index]['slide-name'] !== ''
  ) {
    vue_slide_folder = adv_slide_folders[index]['slide-name'];
  }
  const slide_data = json_structures[adv_folder]['slides'].find((slide) => {
    return slide['slide-folder'] === slide_folder;
  });
  let slide_name = slide_data['slide-name'];
  if (!slide_name || slide_name == '') {
    slide_name = '--replace-by-slide-folder-name';
  }
  let slide_id = slide_data['slide-id'];
  if (!slide_id || slide_id == '') {
    slide_id = '--replace-by-slide-id';
  }
  let slide_data_asset_id = slide_data['slide-data-asset-id'];
  if (!slide_data_asset_id || slide_data_asset_id == '') {
    slide_data_asset_id = '--replace-by-slide-data-asset-id';
  }
  const vueFilePath = path.join(
    WIZ_OUTPUT_FOLDER,
    adv_folder,
    vue_slide_folder,
    'index.vue'
  );
  // if (adv_folder === 'LRP_ONCO_ADV_FINAL_GL_EN' && vue_slide_folder === 'slide_001') {
  //   console.log('JHPD - vueFilePath - ', vueFilePath);
  //   console.log('JHPD - wizActions - ', wizActions);
  // }
  const processedElements = {};

  function generateChildElements(children, ewizardElements) {
    return children
      .filter((child) => !processedElements[child.id]) // Filter out processed elements
      .map((child) => {
        processedElements[child.id] = true;
        const grandChildren = ewizardElements.filter(
          (grandChild) => grandChild.parentId === child.id
        );
        const grandChildElements =
          grandChildren.length > 0
            ? generateChildElements(grandChildren, ewizardElements)
            : '';
        const elementName = child.elementName;
        var text_transfer_id = '';
        if (child.elementName === EWIZARD_TEXT_ELEMENT) {
          text_transfer_id = ` :text="$t('${child.id}')"`;
        }
        var src_img = '';
        if (
          child.elementName === EWIZARD_IMAGE_ELEMENT ||
          child.elementName === EWIZARD_VIDEO_ELEMENT
        ) {
          src_img = ` src="${child.src}"`;
        }
        var popup_attr = '';
        if (child.elementName === EWIZARD_POPUP_ELEMENT) {
          popup_attr = ` :show-on-enter="false" :close-on-outside-tap="true" :show-overlay="true"`;
        }
        let wizAction = '';
        if (
          wizActions[child.id] &&
          !wizActions[child.id].includes('NOT APPLICABLE')
        ) {
          wizAction = wizActions[child.id];
        }
        return (
          `<${elementName}` +
          ` id="${child.id}"` +
          text_transfer_id +
          popup_attr +
          wizAction +
          ` ${src_img} >
          ${grandChildElements}
          </${elementName}>`
        );
      })
      .join('\n  ');
  }

  // Process parent elements first
  const parentElements = ewizardElements.filter(
    (element) =>
      !element.parentId && !EXCLUDED_ELEMENTS.includes(element.elementName)
  );
  parentElements.forEach((element) => {
    processedElements[element.id] = true; // Mark parent as processed
  });

  // Generate Vue code for parent elements
  const parentVueContent = parentElements
    .map((element) => {
      const children = ewizardElements.filter(
        (child) => child.parentId === element.id
      );
      const childElements =
        children.length > 0
          ? generateChildElements(children, ewizardElements)
          : '';
      const elementName = element.elementName;
      if (elementName === EWIZARD_ACTION_ELEMENT) {
        return '';
      }
      var text_transfer_id = '';
      if (
        element.elementName === EWIZARD_TEXT_ELEMENT ||
        element.elementName === EWIZARD_BUTTON_ELEMENT
      ) {
        text_transfer_id = ` :text="$t('${element.id}')"`;
      }
      var src_img = '';
      if (
        element.elementName === EWIZARD_IMAGE_ELEMENT ||
        element.elementName === EWIZARD_VIDEO_ELEMENT
      ) {
        src_img = ` src="${element.src}"`;
      }
      var popup_attr = '';
      if (element.elementName === EWIZARD_POPUP_ELEMENT) {
        popup_attr = ` :show-on-enter="false" :close-on-outside-tap="true" :show-overlay="true"`;
      }
      let wizAction = '';
      if (
        wizActions[element.id] &&
        !wizActions[element.id].includes('NOT APPLICABLE')
      ) {
        wizAction = ` ${wizActions[element.id]}`;
      }
      return (
        `<${elementName}` +
        ` id="${element.id}"` +
        text_transfer_id +
        popup_attr +
        wizAction +
        ` ${src_img} >
          ${childElements}
          </${elementName}>`
      );
    })
    .join('\n  ');

  const vueContent = `
<i18n>
{
  "eng": {
    ${ewizardElements
      .map((element) => {
        if (
          element.elementName === EWIZARD_TEXT_ELEMENT ||
          element.elementName === EWIZARD_BUTTON_ELEMENT
        ) {
          return `"${element.id}": "${element.htmlContent.replaceAll(
            '"',
            "'"
          )}",`;
        }
      })
      .join('\n    ')
      .replace(/,\s*$/, '')
      .trim()}
  }
}
</i18n>
<template>
  <wiz-slide
    data-asset-id="${slide_data_asset_id}"
    id="${slide_id}"
    class="editable-block">
    ${parentVueContent}
  </wiz-slide>
</template>

<script>
export default {
  name: "${slide_name}",
  data() {
    return {
    };
  },
};
</script>

<style editor>
  ${ewizardElements
    .map((element) => {
      let cssStyle = '';
      if (element.elementName === EWIZARD_SLIDE_ELEMENT) {
        const style = element.style;
        var modifiedStyle = style.replace(/--[a-z-]+\s*:\s*[^;]+;?/g, '');
        if (element.src && element.src != '') {
          modifiedStyle = `${modifiedStyle} background: url("slides/${slide_name}/${element.src.replace(
            './media',
            'media'
          )}") center center / cover no-repeat;`;
        }
        if (modifiedStyle !== '') {
          cssStyle = `  #app #${slide_id}.wiz-slide {
    ${modifiedStyle}
  }`;
        }
      } else if (
        element.elementName.includes('wiz-') &&
        !EXCLUDED_ELEMENTS.includes(element.elementName)
      ) {
        const style = element.style;
        // const zIndex = style.match(/z-index:\s*(\d+);?/);
        // const modifiedStyle = zIndex ? style : `${style} z-index: 1;`;
        var modifiedStyle = style.replace(/--[a-z-]+\s*:\s*[^;]+;?/g, '');
        if (element.elementName === EWIZARD_POPUP_ELEMENT) {
          modifiedStyle = modifiedStyle.replace('opacity: 100;', '');
          const ewTop = element.top.replace('px', '');
          const ewLeft = element.left.replace('px', '');
          const ewWidth = element.width;
          const ewHeight = element.height;
          modifiedStyle = `${modifiedStyle} 
  -webkit-transform: matrix(1,0,0,1,${ewLeft},${ewTop});
  -ms-transform: matrix(1,0,0,1,${ewLeft},${ewTop});
  transform: matrix(1,0,0,1,${ewLeft},${ewTop});
  position: absolute;
  width: ${ewWidth};
  height: ${ewHeight};`;
        }
        if (
          element.elementName !== EWIZARD_IMAGE_ELEMENT &&
          element.elementName !== EWIZARD_VIDEO_ELEMENT &&
          element.src &&
          element.src != ''
        ) {
          modifiedStyle = `${modifiedStyle} background: url("slides/${slide_name}/${element.src.replace(
            './media',
            'media'
          )}") center center / cover no-repeat;`;
        }
        let elementClass = '';
        if (element.elementName === EWIZARD_BUTTON_ELEMENT) {
          elementClass = '.wiz-button';
        } else if (element.elementName === EWIZARD_POPUP_ELEMENT) {
          elementClass = '.wiz-popup';
        }
        if (modifiedStyle !== '') {
          cssStyle = `  #app #${slide_id} #${element.id}${elementClass} {
    ${modifiedStyle}
  }`;
        }
      }
      return cssStyle;
    })
    .join('\n')}
</style>
`;

  fs.writeFileSync(vueFilePath, vueContent);
  console.log(
    `Create index vue file of ADV "${adv_folder}" - slide "${slide_folder}"`
  );
  startGeneratingWiz(
    adv_folders,
    json_structures,
    adv_slide_folders,
    index + 1
  );
}

function generateStructure() {
  const advSlide_rows = [];
  fs.createReadStream(ADV_ANALYSIS_FILE)
    .pipe(csv.parse({ headers: true }))
    .on('data', (row) => {
      advSlide_rows.push(row);
    })
    .on('end', () => {
      let json_structures = {};
      const adv_folders = [];
      const adv_slide_folders = [];
      for (
        let advSlide_i = 0;
        advSlide_i < advSlide_rows.length;
        advSlide_i++
      ) {
        const advSlide_row = advSlide_rows[advSlide_i];
        // ADV-name	Slide-name	aa-binder-id	aa-slide-id	slide-order	cloned-adv-name	chapter	slide-name	slide-data-asset-id	slide-id
        const adv_folder = advSlide_row['ADV-name'];
        const slide_folder = advSlide_row['Slide-name'];
        let created_slide_folder = slide_folder;
        let slide_name = '';
        if (advSlide_row['slide-name'] && advSlide_row['slide-name'] !== '') {
          slide_name = advSlide_row['slide-name'];
          created_slide_folder = slide_name;
        }
        adv_slide_folders.push({
          'adv-folder': adv_folder,
          'slide-folder': slide_folder,
          'slide-name': slide_name,
        });
        if (!json_structures[adv_folder]) {
          json_structures[adv_folder] = {
            'cloned-adv-name': advSlide_row['cloned-adv-name'],
            slides: [],
            structure_json: {
              slides: {},
            },
          };
          adv_folders.push(adv_folder);
        }

        const slide_info = {
          'slide-folder': advSlide_row['Slide-name'] || '',
          'slide-order': advSlide_row['slide-order'] || '',
          chapter: advSlide_row['chapter'] || '',
          'slide-name': advSlide_row['slide-name'] || '',
          'slide-data-asset-id': advSlide_row['slide-data-asset-id'] || '',
          'slide-id': advSlide_row['slide-id'] || '',
        };
        json_structures[adv_folder]['slides'].push(slide_info);
        if (advSlide_row['slide-name']) {
          const slide_name = advSlide_row['slide-name'];
          json_structures[adv_folder]['structure_json']['slides'][slide_name] =
            {
              name: advSlide_row['Slide-name'],
              template: `slides/${slide_name}/index.vue`,
              nameOriginal: 'Blank slide',
            };
        }

        const advFolderPath = path.join(WIZ_OUTPUT_FOLDER, adv_folder);
        // Create the ADV folder if it doesn't exist
        if (!fs.existsSync(advFolderPath)) {
          fs.mkdirSync(advFolderPath, { recursive: true });
        }
        const slideFolderPath = path.join(
          WIZ_OUTPUT_FOLDER,
          adv_folder,
          created_slide_folder
        );
        if (!fs.existsSync(slideFolderPath)) {
          fs.mkdirSync(slideFolderPath, { recursive: true });
        }
        const csvMediaFolder = path.join(
          CSV_STRUCTURE_FOLDER,
          adv_folder,
          slide_folder,
          'media'
        );
        const convertedMediaFolder = path.join(
          WIZ_OUTPUT_FOLDER,
          adv_folder,
          created_slide_folder,
          'media'
        );
        if (fs.existsSync(csvMediaFolder)) {
          fs.mkdirSync(convertedMediaFolder, { recursive: true });
          fs.cpSync(csvMediaFolder, convertedMediaFolder, { recursive: true });
        }

        const csvSharedMediaFolder = path.join(
          CSV_STRUCTURE_FOLDER,
          adv_folder,
          'shared',
          'media'
        );
        const convertedSharedMediaFolder = path.join(
          WIZ_OUTPUT_FOLDER,
          adv_folder,
          'shared',
          'media'
        );
        if (fs.existsSync(csvSharedMediaFolder)) {
          const convertedSharedFolder = path.join(
            WIZ_OUTPUT_FOLDER,
            adv_folder,
            'shared'
          );
          if (!fs.existsSync(convertedSharedFolder)) {
            fs.mkdirSync(convertedSharedFolder, { recursive: true });
            fs.mkdirSync(convertedSharedMediaFolder, { recursive: true });
            fs.cpSync(csvSharedMediaFolder, convertedSharedMediaFolder, {
              recursive: true,
            });
          }
        }
      }

      for (
        let adv_folder_i = 0;
        adv_folder_i < adv_folders.length;
        adv_folder_i++
      ) {
        const adv_folder = adv_folders[adv_folder_i];
        const advFolderPath = path.join(WIZ_OUTPUT_FOLDER, adv_folder);
        // Write the JSON file to the ADV folder
        const jsonFilePath = path.join(advFolderPath, 'structure.json');
        fs.writeFileSync(
          jsonFilePath,
          JSON.stringify(json_structures[adv_folder]['structure_json'], null, 2)
        );
      }
      startGeneratingWiz(adv_folders, json_structures, adv_slide_folders, 0);
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

const ADV_ANALYSIS_FILE = 'adv_analysis.csv';
const CSV_STRUCTURE_FOLDER = 'EW_csv_structures'; // Replace with the actual path to your folder
const WIZ_OUTPUT_FOLDER = 'EW_Converted_ADVs'; // Replace with the desired output folder
deleteContents(WIZ_OUTPUT_FOLDER);
generateStructure();
