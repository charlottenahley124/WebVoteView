//
// This file shows the minimum you need to provide to BookReader to display a book
//
// Copyright(c)2008-2009 Internet Archive. Software license AGPL version 3.

// Create the BookReader object
br = new BookReader();

// Return the width of a given page.  Here we assume all images are 800 pixels wide
br.getPageWidth = function(index) {
    return 800;
};

// Return the height of a given page.  Here we assume all images are 1200 pixels high
br.getPageHeight = function(index) {
    return 1200;
};

// Pad number with 0 up to 4
function zeroPad(number) {
  if (number<=9999) { number = ("000"+number).slice(-4); }
  return number;
}

// We load the images from archive.org -- you can modify this function to retrieve images
// using a different URL structure
br.getPageURI = function(index, reduce, rotate) {
    // reduce and rotate are ignored in this simple implementation, but we
    // could e.g. look at reduce and load images from a different directory
    // or pass the information to an image server
    var baseUrl = '/static/img/scans/'
    var bookPath = 'house_journal/original/';
    var branchStr = '001';
    // Not the same as the printed page number because of titlepage etc.
    var controlPageNumber = zeroPad(index);
    var imgFilename = branchStr + '_' + controlPageNumber;
    // var imgStr = zeroPad((index+1), 4).toString();
    // var url = 'http://www.archive.org/download/BookReader/img/page'+leafStr.replace(re, imgStr) + '.jpg';
    //leafStr.replace(re, imgStr)
    var url = baseUrl + bookPath + branchStr + '/' + imgFilename + '.jpg';
    return url;
};

// Return which side, left or right, that a given page should be displayed on
br.getPageSide = function(index) {
    if (0 == (index & 0x1)) {
        return 'R';
    } else {
        return 'L';
    }
};

// This function returns the left and right indices for the user-visible
// spread that contains the given index.  The return values may be
// null if there is no facing page or the index is invalid.
br.getSpreadIndices = function(pindex) {
    var spreadIndices = [null, null];
    if ('rl' == this.pageProgression) {
        // Right to Left
        if (this.getPageSide(pindex) == 'R') {
            spreadIndices[1] = pindex;
            spreadIndices[0] = pindex + 1;
        } else {
            // Given index was LHS
            spreadIndices[0] = pindex;
            spreadIndices[1] = pindex - 1;
        }
    } else {
        // Left to right
        if (this.getPageSide(pindex) == 'L') {
            spreadIndices[0] = pindex;
            spreadIndices[1] = pindex + 1;
        } else {
            // Given index was RHS
            spreadIndices[1] = pindex;
            spreadIndices[0] = pindex - 1;
        }
    }

    return spreadIndices;
};

// For a given "accessible page index" return the page number in the book.
//
// For example, index 5 might correspond to "Page 1" if there is front matter such
// as a title page and table of contents.
br.getPageNum = function(index) {
    return index+1;
};

// Total number of leafs
br.numLeafs = 15;

// Book title and the URL used for the book title link
br.bookTitle= 'Journal of the United States House of Representatives';
// br.bookUrl = 'http://www.archive.org/details/BookReader';
br.bookUrlText = 'Back to details on Voteview';
br.bookUrlTitle = 'Back to details on Voteview';
// thumbnail is optional, but it is used in the info dialog
// br.thumbnail = '//www.archive.org/download/BookReader/img/page014.jpg';
// Metadata is optional, but it is used in the info dialog
br.metadata = [
  {label: 'Title', value: 'Journal of the United States House of Representatives'},
  {label: 'Author', value: 'Voteview'},
  {label: 'Info', value: 'Read the original source document from images.'},

];
// This toggles the mobile drawer (not shown in 'embed' mode)
br.enableMobileNav = true;
br.mobileNavTitle = 'BookReader demo';

// Override the path used to find UI images
br.imagesBaseURL = '../BookReader/images/';

br.getEmbedCode = function(frameWidth, frameHeight, viewParams) {
    return "Embed code not supported in bookreader demo.";
};

// Note previously the UI param was used for mobile, but it's going to be responsive
// embed === iframe

br.ui = 'full'; // embed, full (responsive)

// Let's go!
br.init();

// read-aloud and search need backend compenents and are not supported in the demo
$('#BRtoolbar').find('.read').hide();
$('.BRtoolbarSectionSearch').hide();
// $('#btnSrch').hide();
