const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const csv = require('fast-csv');

function readEWClonedADVFolder(adv_slides_data, index) {
  if (index >= adv_slides_data.length) {
    createNewADVAnalysisFile(adv_slides_data);
    return;
  }

  const cloned_adv_folder = adv_slides_data[index]['cloned-adv-name'];
  const slide_name = adv_slides_data[index]['slide-name'];
  if (cloned_adv_folder === '' && slide_name === '') {
    index = index + 1;
    readEWClonedADVFolder(adv_slides_data, index);
    return;
  }
  const clonedADVSlidePath = path.join(
    EWClonedADVsFolder,
    cloned_adv_folder,
    'slides',
    slide_name
  );
  const clonedSlideVueIndexPath = path.join(clonedADVSlidePath, 'index.vue');

  fs.readFile(clonedSlideVueIndexPath, 'utf8', (err, htmlContent) => {
    if (err) {
      console.error('Error reading file:', clonedSlideVueIndexPath, err);
      index = index + 1;
      readEWClonedADVFolder(adv_slides_data, index);
      return;
    }

    const $ = cheerio.load(htmlContent);
    const slideId = $('wiz-slide').attr('id');
    const dataAssetId = $('wiz-slide').attr('data-asset-id');
    adv_slides_data[index]['slide-id'] = slideId;
    adv_slides_data[index]['slide-data-asset-id'] = dataAssetId;

    index = index + 1;
    readEWClonedADVFolder(adv_slides_data, index);
  });
}

function createNewADVAnalysisFile(adv_slides_data) {
  // Create a timestamp for the filename
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '-');

  // Rename the existing file
  const currentCsvPath = path.join('adv_analysis.csv');
  const oldCsvPath = path.join(`adv_analysis_${timestamp}.csv`);
  fs.renameSync(currentCsvPath, oldCsvPath);

  // Create a new CSV file
  const csvStream = csv.format({ headers: true });
  csvStream.pipe(fs.createWriteStream(currentCsvPath)).on('finish', () => {
    console.log('New adv_analysis.csv file created successfully.');
  });

  // Write the new data to the CSV
  adv_slides_data.forEach((element) => {
    csvStream.write(element);
  });

  csvStream.end();
}

function readADVStructureFile() {
  const adv_slides_data = [];
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
          'ADV-name': adv_slide_row['ADV-name'],
          'Slide-name': adv_slide_row['Slide-name'],
          'slide-order': adv_slide_row['slide-order'] || '',
          'cloned-adv-name': adv_slide_row['cloned-adv-name'] || '',
          chapter: adv_slide_row['chapter'] || '',
          'slide-name': adv_slide_row['slide-name'] || '',
          'slide-data-asset-id': adv_slide_row['slide-data-asset-id'] || '',
          'slide-id': adv_slide_row['slide-id'] || '',
        };
        adv_slides_data.push(adv_slide_data);
      }

      readEWClonedADVFolder(adv_slides_data, 0);
    });
}

const EWClonedADVsFolder = 'EW_cloned_ADVs';
const ADV_Analysis_Path = 'adv_analysis.csv';
readADVStructureFile();
