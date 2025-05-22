const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const csv = require('fast-csv');

const FUSION_LIST = [
  'fusion-group',
  'fusion-text',
  'fusion-image',
  'fusion-button',
  'fusion-shape',
  'fusion-action',
  'fusion-popup',
  'fusion-custom-popup-overlay',
];

function extractFusionElements(
  htmlContent,
  adv_folder_name,
  slide_folder_name
) {
  const $ = cheerio.load(htmlContent);
  const slideId = $('article').attr('id');
  const fusionElement = {};
  fusionElement['ADV-name'] = adv_folder_name;
  fusionElement['Slide-name'] = slide_folder_name;
  fusionElement['aa-binder-id'] = '';
  fusionElement['aa-slide-id'] = '';
  fusionElement['slide-order'] = '';
  fusionElement['cloned-adv-name'] = '';
  fusionElement['chapter'] = '';
  fusionElement['slide-name'] = '';
  fusionElement['slide-data-asset-id'] = '';
  fusionElement['slide-id'] = '';
  for (var fusionTagNameIndex in FUSION_LIST) {
    const fusionTagName = FUSION_LIST[fusionTagNameIndex];
    fusionElement[fusionTagName] = 0;
    $(fusionTagName).each((index, element) => {
      // const $element = $(element);
      fusionElement[fusionTagName]++;
    });
  }
  return fusionElement;
}

function arrangeFusionElements(fusionElements) {
  return fusionElements.sort((a, b) => {
    if (a['ADV-name'] !== b['ADV-name']) {
      return a['ADV-name'].localeCompare(b['ADV-name']);
    } else {
      return a['Slide-name'].localeCompare(b['Slide-name']);
    }
  });
}

function readHTMLFilesInFolders(folderPath) {
  const folders = fs.readdirSync(folderPath);

  const csvStream = csv.format({ headers: true });

  csvStream.pipe(fs.createWriteStream(outputCsvPath)).on('finish', () => {
    console.log(`CSV file of '${folders.length}' ADVs created successfully.`);
  });

  const fusionElements = [];
  let slide_total = 0;
  let slide_count = 0;
  folders.forEach((adv_folder) => {
    const adv_name = adv_folder;
    const currentADVFolderPath = path.join(folderPath, adv_folder);
    if (fs.lstatSync(currentADVFolderPath).isDirectory()) {
      console.log(`Processing ADV: ${adv_name}`);
      const slide_folders = fs.readdirSync(currentADVFolderPath);
      slide_folders.forEach((slide_folder) => {
        const currentSlideFolderPath = path.join(
          currentADVFolderPath,
          slide_folder
        );
        if (fs.lstatSync(currentSlideFolderPath).isDirectory()) {
          const files = fs.readdirSync(currentSlideFolderPath);
          files.forEach((file) => {
            const filePath = path.join(currentSlideFolderPath, file);
            if (path.extname(filePath) === '.html') {
              slide_total = slide_total + 1;
              fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                  console.error('Error reading file:', filePath, err);
                  return;
                }

                const fusionElement = extractFusionElements(
                  data,
                  adv_folder,
                  slide_folder
                );
                // console.log('JHPD - element - ', fusionElement);
                // console.log(`Processing file: ${filePath}`);
                fusionElements.push(fusionElement);
                slide_count = slide_count + 1;
                if (slide_count === slide_total) {
                  const sortedFusionElements =
                    arrangeFusionElements(fusionElements);
                  // console.log('JHPD - fusionElements - ', sortedFusionElements);
                  console.log(
                    `WRITING fusionElements to file ${outputCsvPath}...`
                  );
                  sortedFusionElements.forEach((element) => {
                    csvStream.write(element);
                  });
                  csvStream.end(); // Call end after writing all elements
                  console.log(
                    `FINISHED writing fusionElements to file ${outputCsvPath}...`
                  );
                }
              });
            }
          });
        }
      });
    }
  });
}
function initFolders() {
  const folders = [
    'AA_ADVs',
    'AA_csv_structures',
    'ADV__Requests',
    'EW_cloned_ADVs',
    'EW_Converted_ADVs',
    'EW_csv_structures',
  ];
  let init_flag = false;
  for (let folder_i = 0; folder_i < folders.length; folder_i++) {
    const folder = folders[folder_i];
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      console.log(`Created folder: ${folder}`);
      init_flag = true;
    }
  }
  if (init_flag) {
    console.log(
      `Folder "ADV__Requests": You should store all the request from client in this folder to easily track.`
    );
    console.log(
      `Folder "AA_ADVs": Contains all exported ADVs from Anthill Activator.`
    );
    console.log(
      `Folder "AA_csv_structures": After running step 1, the corresponding csv files will be created in each slide of each ADV based on folder AA_ADVs.`
    );
    console.log(
      `Folder "EW_csv_structures": After running step 2, the csv structures of Anthill will be converted to the EWizard strcutures. You can ignore the 1st and 2nd steps if you only want to work with EWizard platform.`
    );
    console.log(
      `Folder "EW_cloned_ADVs": Using wiz clone <ewizard-adv-url-id>, you have to clone the clonning ADV to get the information after step 3 of slide-id, data-asset-id to avoid manually copying them into the cloned ADVs.`
    );
    console.log(
      `Folder "EW_Converted_ADVs": After running step 4, you will have the clean Ewziard slide structures in corresponding ADV folder with structure file for you to copying to the cloned_ADV before using pushing CLI "wiz push" to update the changes to the EWizard platform.`
    );
  }
  return true;
}
const AA_slidesFolder = 'AA_ADVs'; // Replace with the actual path to your folder
const outputCsvPath = `adv_analysis.csv`;
initFolders();
readHTMLFilesInFolders(AA_slidesFolder);
