var RESIZE = 15; // Scale pattern canvas by this much

var out = document.getElementById('out');
var scaled = document.getElementById('scaled');

var img = null;
document.getElementById('file').onchange = function(e) {
  var files = e.target.files || e.dataTransfer.files;
  update(files[0]);
};

document.getElementById('bwpattern').onchange = function() {
  if (img == null) { return; }
  palettize();
};

document.getElementById('palette').onchange = function() {
  if (img == null) { return; }
  palettize();
};

var samples = document.getElementsByTagName('img');
for (var i = 0; i < samples.length; i++) {
  samples[i].onclick = function(e) {
    img = e.target;
    palettize();
  };
  samples[i].style.cursor = 'pointer';
}

function palettize() {
  var orig = document.createElement('canvas');
  var origCtx = orig.getContext('2d');
  orig.width = img.width;
  orig.height = img.height;
  origCtx.drawImage(img, 0, 0);
  document.getElementById('orig').src = orig.toDataURL();

  var outCtx = out.getContext('2d');
  out.width = img.width;
  out.height = img.height;

  // Apply palette to the image
  var imgd = origCtx.getImageData(0, 0, orig.width, orig.height);
  var palette = palettes[document.getElementById('palette').value];
  var pix = imgd.data;
  var map = {};
  closestMap = {};
  for (var i = 0, n = pix.length; i < n; i += 4) {
    var r = pix[i  ] * pix[i+3]/255;
    var g = pix[i+1] * pix[i+3]/255;
    var b = pix[i+2] * pix[i+3]/255;
    if (pix[i+3] == 0) {
      // transparent
      continue;
    }
    var cl = closest([r, g, b], palette.colors);
    if (cl in map) { map[cl]++; } else { map[cl] = 1; }
    pix[i  ] = cl[0];
    pix[i+1] = cl[1];
    pix[i+2] = cl[2];
  }
  outCtx.putImageData(imgd, 0, 0);
  out.onclick = function() { window.open(out.toDataURL()); };

  if (orig.width * orig.height < 1000000 ||
      !window.confirm('This is a large image, are you sure you want to generate the pattern? It may take a while...')) {
    drawCanvas(map);
  }

  document.getElementById('dimensions').innerText = (
    Math.round(out.width*palette.dimensions*100)/100 + '" wide, ' +
    Math.round(out.height*palette.dimensions*100)/100 + '" tall');
}

// TODO: unicode symbols?
var ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-=_+,./\][{}:"<>?'.split('');

function drawCanvas(map) {
  var imgd = out.getContext('2d').getImageData(0, 0, out.width, out.height);
  var scaledCtx = scaled.getContext('2d');
  scaledCtx.lineWidth = 1;
  scaled.width = out.width * RESIZE;
  scaled.height = out.height * RESIZE;
  var symbols = {}, a = 0;
  for (var x = 0; x < orig.width; x++) {
    for (var y = 0; y < orig.height; y++) {
      var idx = y*out.width*4 + x*4;
      var p = imgd.data.subarray(idx, idx+4);
      if (p[3] != 0) {
        var c = hex(p);

        if (document.getElementById('bwpattern').checked) {
          if (!symbols[c]) {
            symbols[c] = ALPHABET[a++];
          }
          var s = symbols[c];
          scaledCtx.font = '12px Arial';
          scaledCtx.strokeText(s, x*RESIZE+RESIZE/3, y*RESIZE+RESIZE*2/3, RESIZE);
        } else {
          scaledCtx.fillStyle = c;
          scaledCtx.fillRect(x*RESIZE, y*RESIZE, RESIZE-1, RESIZE-1);
        }
      }
      scaledCtx.strokeRect(x*RESIZE, y*RESIZE, RESIZE-1, RESIZE-1);
    }
  }

  // Draw major lines every 10 cells
  scaledCtx.lineWidth = 4;
  for (var x = 0; x < scaled.width; x += 10*RESIZE) {
    scaledCtx.moveTo(x, 0);
    scaledCtx.lineTo(x, scaled.height);
    scaledCtx.stroke();
  }
  for (var y = 0; y < scaled.height; y+= 10*RESIZE) {
    scaledCtx.moveTo(0, y);
    scaledCtx.lineTo(scaled.width, y);
    scaledCtx.stroke();
  }

  var s = document.getElementById('selected');
  var st = document.getElementById('selected-text');
  var sc = document.getElementById('selected-color');
  var palette = palettes[document.getElementById('palette').value];
  scaled.onmousemove = function(e) {
    var x = Math.floor(e.offsetX / RESIZE);
    var y = Math.floor(e.offsetY / RESIZE);
    var idx = y*out.width*4 + x*4;
    var p = imgd.data.subarray(idx, idx+4);
    s.style.display = (p[3] == 0) ? 'none': '';
    if (p[3] == 0) {
      return;
    }
    s.style.position = 'absolute';
    s.style.top = e.pageY + 20;
    s.style.left = e.pageX + 20;
    for (k in map) {
      var ks = k.split(',');
      var t = [p[0], p[1], p[2]].join(',');
      var k2 = k.split(',').slice(0,3).join(',');
      var hc = hex(p);
      if (t == k2) {
        st.innerText = ks[3] + ' @ (' + x + ','+ y + ')';
        if (hc in symbols) {
          st.innerText = '(' + symbols[hc] + ') ' + st.innerText;
        }
        sc.style.backgroundColor = hc;
        break;
      }
    }
  };
  scaled.onmouseout = function() { s.style.display = 'none'; };

  printMap(map, symbols);
}

function update(file) {
  var reader = new FileReader();
  reader.onload = function(e){
    img = new Image();
    img.src = e.target.result;
    palettize();
  };
  reader.readAsDataURL(file);
};

// color is a three-element array
var closestMap = {};
function closest(color, palette) {
  if (color in closestMap) { return closestMap[color]; }
  var closest = null;
  var dist = Infinity;
  for (var i = 0; i < palette.length; i++) {
    var c = palette[i];
    if (color == c) { return c; }
    var d = distance(c, color);
    if (closest == null || d < dist) {
      closest = c;
      dist = d;
    }
  }
  closestMap[color] = closest;
  return closest;
}

function distance(a, b) {
  return Math.sqrt(
      Math.pow(Math.abs(a[0]-b[0]), 2) +
      Math.pow(Math.abs(a[1]-b[1]), 2) +
      Math.pow(Math.abs(a[2]-b[2]), 2));
}

function hex(color) {
  var r = parseInt(color[0]).toString(16); if (r.length == 1) { r = '0' + r; }
  var g = parseInt(color[1]).toString(16); if (g.length == 1) { g = '0' + g; }
  var b = parseInt(color[2]).toString(16); if (b.length == 1) { b = '0' + b; }
  return '#' + r + g + b;
}

function printMap(map, symbols) {
  document.getElementById('table').style.display = '';
  // Sort map by color count
  var arr = [];
  for (k in map) {
    arr.push({'count': map[k], 'color': k.split(',')});
  }
  arr.sort(function(a, b) {
    if (a.count == b.count) { return 0; }
    if (a.count < b.count) { return 1; }
    return -1;
  });

  // Clear the table
  var table = document.getElementById('counts');
  while (table.firstChild) {
    table.removeChild(table.firstChild);
  }

  for (var i = 0; i < arr.length; i++) {
    var c = hex(arr[i].color);
    var tr = document.createElement('tr');
    var c0 = document.createElement('td');
    if (c in symbols) {
      c0.innerText = '(' + symbols[c] + ') ';
    }
    var c1 = document.createElement('td');
    c1.innerText = arr[i].color[3];
    var c2 = document.createElement('td');
    c2.innerText = arr[i].count;
    var c3 = document.createElement('td');
    c3.style.backgroundColor = c;
    c3.style.width = '100px';

    tr.appendChild(c0);
    tr.appendChild(c1);
    tr.appendChild(c2);
    tr.appendChild(c3);
    table.appendChild(tr);
  }
}

var palettes = {
  'dmc': {'dimensions': 1.0 / 14, 'colors': [ // 14-count
    [69, 92, 113, '930-Antique Blue Dark'],
    [162, 181, 198, '932-Antique Blue Light'],
    [106, 133, 158, '931-Antique Blue Medium'],
    [219, 226, 233, '3753-Antique Blue Ult Vy Lt'],
    [56, 76, 94, '3750-Antique Blue Very Dk'],
    [199, 209, 219, '3752-Antique Blue Very Lt'],
    [155, 91, 102, '3726-Antique Mauve Dark'],
    [219, 169, 178, '3727-Antique Mauve Light'],
    [129, 73, 82, '315-Antique Mauve Md Dk'],
    [183, 115, 127, '316-Antique Mauve Med'],
    [113, 65, 73, '3802-Antique Mauve Vy Dk'],
    [223, 179, 187, '778-Antique Mauve Vy Lt'],
    [120, 87, 98, '3740-Antique Violet Dark'],
    [183, 157, 167, '3042-Antique Violet Light'],
    [149, 111, 124, '3041-Antique Violet Medium'],
    [215, 203, 211, '3743-Antique Violet Vy Lt'],
    [252, 171, 152, '3341-Apricot'],
    [254, 205, 194, '3824-Apricot Light'],
    [255, 131, 111, '3340-Apricot Med'],
    [255, 222, 213, '967-Apricot Very Light'],
    [80, 139, 125, '3814-Aquamarine'],
    [71, 123, 110, '991-Aquamarine Dk'],
    [111, 174, 159, '992-Aquamarine Lt'],
    [144, 192, 180, '993-Aquamarine Vy Lt'],
    [99, 100, 88, '535-Ash Gray Vy Lt'],
    [242, 151, 70, '3853-Autumn Gold Dk'],
    [250, 211, 150, '3855-Autumn Gold Lt'],
    [242, 175, 104, '3854-Autumn Gold Med'],
    [114, 132, 60, '469-Avocado Green'],
    [66, 77, 33, '935-Avocado Green Dk'],
    [98, 113, 51, '937-Avocado Green Md'],
    [49, 57, 25, '934-Avocado Grn Black'],
    [148, 171, 79, '470-Avocado Grn Lt'],
    [216, 228, 152, '472-Avocado Grn U Lt'],
    [76, 88, 38, '936-Avocado Grn V Dk'],
    [174, 191, 121, '471-Avocado Grn V Lt'],
    [147, 180, 206, '3755-Baby Blue'],
    [90, 143, 184, '322-Baby Blue Dark'],
    [184, 210, 230, '3325-Baby Blue Light'],
    [115, 159, 193, '334-Baby Blue Medium'],
    [205, 223, 237, '3841-Baby Blue Pale'],
    [44, 89, 124, '803-Baby Blue Ult Vy Dk'],
    [238, 252, 252, '3756-Baby Blue Ult Vy Lt'],
    [53, 102, 139, '312-Baby Blue Very Dark'],
    [217, 235, 241, '775-Baby Blue Very Light'],
    [255, 223, 217, '818-Baby Pink'],
    [255, 238, 235, '819-Baby Pink Light'],
    [135, 125, 115, '646-Beaver Gray Dk'],
    [188, 180, 172, '648-Beaver Gray Lt'],
    [176, 166, 156, '647-Beaver Gray Med'],
    [72, 72, 72, '844-Beaver Gray Ult Dk'],
    [110, 101, 92, '645-Beaver Gray Vy Dk'],
    [230, 232, 232, '3072-Beaver Gray Vy Lt'],
    [103, 85, 65, '839-Beige Brown Dk'],
    [182, 155, 126, '841-Beige Brown Lt'],
    [154, 124, 92, '840-Beige Brown Med'],
    [242, 227, 206, '543-Beige Brown Ult Vy Lt'],
    [89, 73, 55, '838-Beige Brown Vy Dk'],
    [209, 186, 161, '842-Beige Brown Vy Lt'],
    [164, 152, 120, '642-Beige Gray Dark'],
    [231, 226, 211, '822-Beige Gray Light'],
    [221, 216, 203, '644-Beige Gray Med'],
    [127, 106, 85, '3790-Beige Gray Ult Dk'],
    [133, 123, 97, '640-Beige Gray Vy Dk'],
    [0, 0, 0, '310-Black'],
    [30, 17, 8, '3371-Black Brown'],
    [71, 129, 165, '825-Blue Dark'],
    [120, 128, 164, '161-Blue Gray'],
    [199, 202, 215, '159-Blue Gray Light'],
    [153, 159, 183, '160-Blue Gray Medium'],
    [91, 144, 113, '502-Blue Green'],
    [57, 111, 82, '501-Blue Green Dark'],
    [178, 212, 189, '3813-Blue Green Lt'],
    [123, 172, 148, '503-Blue Green Med'],
    [4, 77, 51, '500-Blue Green Vy Dk'],
    [196, 222, 204, '504-Blue Green Vy Lt'],
    [161, 194, 215, '813-Blue Light'],
    [107, 158, 191, '826-Blue Medium'],
    [219, 236, 245, '162-Blue Ultra Very Light'],
    [57, 105, 135, '824-Blue Very Dark'],
    [189, 221, 237, '827-Blue Very Light'],
    [119, 107, 152, '3746-Blue Violet Dark'],
    [183, 191, 221, '341-Blue Violet Light'],
    [152, 145, 182, '155-Blue Violet Med Dark'],
    [163, 174, 209, '156-Blue Violet Med Lt'],
    [173, 167, 199, '340-Blue Violet Medium'],
    [92, 84, 120, '333-Blue Violet Very Dark'],
    [211, 215, 237, '3747-Blue Violet Vy Lt'],
    [227, 29, 66, '666-Bright Red'],
    [98, 93, 80, '3787-Brown Gray Dark'],
    [177, 170, 151, '3023-Brown Gray Light'],
    [142, 144, 120, '3022-Brown Gray Med'],
    [79, 75, 65, '3021-Brown Gray Vy Dk'],
    [235, 234, 231, '3024-Brown Gray Vy Lt'],
    [152, 94, 51, '434-Brown Light'],
    [122, 69, 31, '433-Brown Med'],
    [184, 119, 72, '435-Brown Very Light'],
    [255, 123, 77, '947-Burnt Orange'],
    [253, 93, 53, '608-Burnt Orange Bright'],
    [209, 88, 7, '900-Burnt Orange Dark'],
    [235, 99, 7, '946-Burnt Orange Med'],
    [255, 227, 0, '973-Canary Bright'],
    [255, 181, 21, '972-Canary Deep'],
    [255, 87, 115, '891-Carnation Dark'],
    [252, 144, 162, '893-Carnation Light'],
    [255, 121, 140, '892-Carnation Medium'],
    [255, 178, 187, '894-Carnation Very Light'],
    [101, 165, 125, '3816-Celadon Green'],
    [71, 119, 89, '3815-Celadon Green Dk'],
    [153, 195, 170, '3817-Celadon Green Lt'],
    [77, 131, 97, '163-Celadon Green Md'],
    [44, 106, 69, '561-Celadon Green VD'],
    [123, 181, 71, '703-Chartreuse'],
    [158, 207, 52, '704-Chartreuse Bright'],
    [125, 93, 87, '3860-Cocoa'],
    [98, 75, 69, '779-Cocoa Dark'],
    [166, 136, 129, '3861-Cocoa Light'],
    [101, 57, 25, '801-Coffee Brown Dk'],
    [54, 31, 14, '938-Coffee Brown Ult Dk'],
    [73, 42, 19, '898-Coffee Brown Vy Dk'],
    [198, 98, 24, '921-Copper'],
    [226, 115, 35, '922-Copper Light'],
    [172, 84, 20, '920-Copper Med'],
    [233, 106, 103, '351-Coral'],
    [210, 16, 53, '349-Coral Dark'],
    [253, 156, 151, '352-Coral Light'],
    [224, 72, 72, '350-Coral Medium'],
    [187, 5, 31, '817-Coral Red Very Dark'],
    [76, 82, 110, '158-Cornflower Blu M V D'],
    [96, 103, 140, '3807-Cornflower Blue'],
    [85, 91, 123, '792-Cornflower Blue Dark'],
    [143, 156, 193, '794-Cornflower Blue Light'],
    [112, 125, 162, '793-Cornflower Blue Med'],
    [70, 69, 99, '791-Cornflower Blue V D'],
    [187, 195, 217, '157-Cornflower Blue Vy Lt'],
    [255, 164, 190, '603-Cranberry'],
    [209, 40, 106, '601-Cranberry Dark'],
    [255, 176, 190, '604-Cranberry Light'],
    [226, 72, 116, '602-Cranberry Medium'],
    [205, 47, 99, '600-Cranberry Very Dark'],
    [255, 192, 205, '605-Cranberry Very Light'],
    [255, 251, 239, '712-Cream'],
    [243, 71, 139, '3805-Cyclamen Pink'],
    [224, 40, 118, '3804-Cyclamen Pink Dark'],
    [255, 140, 174, '3806-Cyclamen Pink Light'],
    [148, 168, 198, '809-Delft Blue'],
    [70, 106, 142, '798-Delft Blue Dark'],
    [116, 142, 182, '799-Delft Blue Medium'],
    [192, 204, 222, '800-Delft Blue Pale'],
    [196, 142, 112, '3064-Desert Sand'],
    [182, 117, 82, '3773-Desert Sand Dark'],
    [238, 211, 196, '950-Desert Sand Light'],
    [187, 129, 97, '407-Desert Sand Med'],
    [135, 85, 57, '632-Desert Sand Ult Vy Dk'],
    [160, 108, 80, '3772-Desert Sand Vy Dk'],
    [243, 225, 215, '3774-Desert Sand Vy Lt'],
    [150, 118, 86, '611-Drab Brown'],
    [121, 96, 71, '610-Drab Brown Dk'],
    [188, 154, 120, '612-Drab Brown Lt'],
    [220, 196, 170, '613-Drab Brown V Lt'],
    [232, 135, 155, '3733-Dusty Rose'],
    [207, 115, 115, '961-Dusty Rose Dark'],
    [228, 166, 172, '3354-Dusty Rose Light'],
    [255, 189, 189, '3716-Dusty Rose Med Vy Lt'],
    [230, 138, 138, '962-Dusty Rose Medium'],
    [171, 2, 73, '150-Dusty Rose Ult Vy Dk'],
    [255, 215, 215, '963-Dusty Rose Ult Vy Lt'],
    [188, 67, 101, '3350-Dusty Rose Ultra Dark'],
    [218, 103, 131, '3731-Dusty Rose Very Dark'],
    [240, 206, 212, '151-Dusty Rose Very Light'],
    [240, 234, 218, 'Ecru-Ecru'],
    [20, 170, 208, '3843-Electric Blue'],
    [38, 150, 182, '995-Electric Blue Dark'],
    [48, 194, 236, '996-Electric Blue Medium'],
    [24, 126, 86, '910-Emerald Green Dark'],
    [27, 157, 107, '912-Emerald Green Lt'],
    [24, 144, 101, '911-Emerald Green Med'],
    [21, 111, 73, '909-Emerald Green Vy Dk'],
    [17, 90, 59, '3818-Emerald Grn Ult V Dk'],
    [150, 158, 126, '522-Fern Green'],
    [102, 109, 79, '520-Fern Green Dark'],
    [171, 177, 151, '523-Fern Green Lt'],
    [196, 205, 172, '524-Fern Green Vy Lt'],
    [141, 166, 117, '989-Forest Green'],
    [88, 113, 65, '987-Forest Green Dk'],
    [200, 216, 184, '164-Forest Green Lt'],
    [115, 139, 91, '988-Forest Green Med'],
    [64, 82, 48, '986-Forest Green Vy Dk'],
    [151, 11, 35, '816-Garnet'],
    [123, 0, 27, '814-Garnet Dark'],
    [135, 7, 31, '815-Garnet Medium'],
    [130, 38, 55, '902-Garnet Very Dark'],
    [255, 145, 145, '956-Geranium'],
    [253, 181, 181, '957-Geranium Pale'],
    [173, 114, 57, '3826-Golden Brown'],
    [145, 79, 18, '975-Golden Brown Dk'],
    [220, 156, 86, '977-Golden Brown Light'],
    [194, 129, 66, '976-Golden Brown Med'],
    [247, 187, 119, '3827-Golden Brown Pale'],
    [189, 155, 81, '832-Golden Olive'],
    [141, 120, 75, '830-Golden Olive Dk'],
    [200, 171, 108, '833-Golden Olive Lt'],
    [170, 143, 86, '831-Golden Olive Md'],
    [126, 107, 66, '829-Golden Olive Vy Dk'],
    [219, 190, 127, '834-Golden Olive Vy Lt'],
    [253, 249, 205, '3078-Golden Yellow Vy Lt'],
    [114, 55, 93, '3834-Grape Dark'],
    [186, 145, 170, '3836-Grape Light'],
    [148, 96, 131, '3835-Grape Medium'],
    [87, 36, 51, '154-Grape Very Dark'],
    [101, 127, 127, '3768-Gray Green Dark'],
    [189, 203, 203, '927-Gray Green Light'],
    [152, 174, 174, '926-Gray Green Med'],
    [86, 106, 106, '924-Gray Green Vy Dark'],
    [221, 227, 227, '928-Gray Green Vy Lt'],
    [5, 101, 23, '699-Green'],
    [7, 115, 27, '700-Green Bright'],
    [55, 132, 119, '3850-Green Bright Dk'],
    [73, 179, 161, '3851-Green Bright Lt'],
    [61, 147, 132, '943-Green Bright Md'],
    [156, 164, 130, '3053-Green Gray'],
    [95, 102, 72, '3051-Green Gray Dk'],
    [136, 146, 104, '3052-Green Gray Md'],
    [63, 143, 41, '701-Green Light'],
    [183, 139, 97, '3828-Hazelnut Brown'],
    [160, 112, 66, '420-Hazelnut Brown Dk'],
    [198, 159, 123, '422-Hazelnut Brown Lt'],
    [131, 94, 57, '869-Hazelnut Brown V Dk'],
    [64, 106, 58, '3346-Hunter Green'],
    [27, 89, 21, '3345-Hunter Green Dk'],
    [27, 83, 0, '895-Hunter Green Vy Dk'],
    [51, 131, 98, '505-Jade Green'],
    [143, 192, 152, '563-Jade Light'],
    [83, 151, 106, '562-Jade Medium'],
    [185, 215, 192, '966-Jade Ultra Vy Lt'],
    [167, 205, 175, '564-Jade Very Light'],
    [71, 167, 47, '702-Kelly Green'],
    [137, 138, 88, '3011-Khaki Green Dk'],
    [185, 185, 130, '3013-Khaki Green Lt'],
    [166, 167, 93, '3012-Khaki Green Md'],
    [92, 114, 148, '3838-Lavender Blue Dark'],
    [176, 192, 218, '3840-Lavender Blue Light'],
    [123, 142, 171, '3839-Lavender Blue Med'],
    [163, 123, 167, '209-Lavender Dark'],
    [227, 203, 227, '211-Lavender Light'],
    [195, 159, 195, '210-Lavender Medium'],
    [108, 58, 110, '3837-Lavender Ultra Dark'],
    [131, 91, 139, '208-Lavender Very Dark'],
    [253, 237, 84, '307-Lemon'],
    [255, 214, 0, '444-Lemon Dark'],
    [255, 251, 139, '445-Lemon Light'],
    [143, 67, 15, '400-Mahogany Dark'],
    [207, 121, 57, '3776-Mahogany Light'],
    [179, 95, 43, '301-Mahogany Med'],
    [255, 211, 181, '3856-Mahogany Ult Vy Lt'],
    [111, 47, 0, '300-Mahogany Vy Dk'],
    [247, 167, 119, '402-Mahogany Vy Lt'],
    [201, 107, 112, '3687-Mauve'],
    [171, 51, 87, '3803-Mauve Dark'],
    [251, 191, 194, '3689-Mauve Light'],
    [231, 169, 172, '3688-Mauve Medium'],
    [136, 21, 49, '3685-Mauve Very Dark'],
    [255, 121, 146, '3705-Melon Dark'],
    [255, 203, 213, '3708-Melon Light'],
    [255, 173, 188, '3706-Melon Medium'],
    [231, 73, 103, '3801-Melon Very Dark'],
    [138, 110, 78, '3862-Mocha Beige Dark'],
    [203, 182, 156, '3864-Mocha Beige Light'],
    [164, 131, 92, '3863-Mocha Beige Med'],
    [250, 246, 240, '3866-Mocha Brn Ult Vy Lt'],
    [107, 87, 67, '3781-Mocha Brown Dk'],
    [210, 188, 166, '3782-Mocha Brown Lt'],
    [179, 159, 139, '3032-Mocha Brown Med'],
    [75, 60, 42, '3031-Mocha Brown Vy Dk'],
    [227, 216, 204, '3033-Mocha Brown Vy Lt'],
    [167, 174, 56, '581-Moss Green'],
    [136, 141, 51, '580-Moss Green Dk'],
    [224, 232, 104, '3819-Moss Green Lt'],
    [192, 200, 64, '166-Moss Green Md Lt'],
    [239, 244, 164, '165-Moss Green Vy Lt'],
    [191, 166, 113, '371-Mustard'],
    [204, 183, 132, '372-Mustard Lt'],
    [184, 157, 100, '370-Mustard Medium'],
    [37, 59, 115, '336-Navy Blue'],
    [33, 48, 99, '823-Navy Blue Dark'],
    [27, 40, 83, '939-Navy Blue Very Dark'],
    [136, 186, 145, '954-Nile Green'],
    [162, 214, 173, '955-Nile Green Light'],
    [109, 171, 119, '913-Nile Green Med'],
    [252, 252, 238, '746-Off White'],
    [188, 141, 14, '680-Old Gold Dark'],
    [229, 206, 151, '676-Old Gold Lt'],
    [208, 165, 62, '729-Old Gold Medium'],
    [169, 130, 4, '3829-Old Gold Vy Dark'],
    [245, 236, 203, '677-Old Gold Vy Lt'],
    [148, 140, 54, '732-Olive Green'],
    [147, 139, 55, '731-Olive Green Dk'],
    [199, 192, 119, '734-Olive Green Lt'],
    [188, 179, 76, '733-Olive Green Md'],
    [130, 123, 48, '730-Olive Green V Dk'],
    [229, 92, 31, '720-Orange Spice Dark'],
    [247, 151, 111, '722-Orange Spice Light'],
    [242, 120, 66, '721-Orange Spice Med'],
    [250, 50, 3, '606-Orange-Red Bright'],
    [98, 138, 40, '905-Parrot Green Dk'],
    [199, 230, 102, '907-Parrot Green Lt'],
    [127, 179, 53, '906-Parrot Green Md'],
    [85, 120, 34, '904-Parrot Green V Dk'],
    [254, 215, 204, '353-Peach'],
    [247, 203, 191, '754-Peach Light'],
    [254, 231, 218, '948-Peach Very Light'],
    [100, 171, 186, '807-Peacock Blue'],
    [61, 149, 165, '806-Peacock Blue Dark'],
    [153, 207, 217, '3766-Peacock Blue Light'],
    [52, 127, 140, '3765-Peacock Blue Vy Dk'],
    [229, 252, 253, '747-Peacock Blue Vy Lt'],
    [211, 211, 214, '415-Pearl Gray'],
    [236, 236, 236, '762-Pearl Gray Vy Lt'],
    [108, 108, 108, '317-Pewter Gray'],
    [86, 86, 86, '413-Pewter Gray Dark'],
    [66, 66, 66, '3799-Pewter Gray Vy Dk'],
    [132, 132, 132, '169-Pewter Light'],
    [209, 209, 209, '168-Pewter Very Light'],
    [131, 151, 95, '3364-Pine Green'],
    [94, 107, 71, '3362-Pine Green Dk'],
    [114, 130, 86, '3363-Pine Green Md'],
    [252, 176, 185, '776-Pink Medium'],
    [97, 122, 82, '367-Pistachio Green Dk'],
    [166, 194, 152, '368-Pistachio Green Lt'],
    [105, 136, 90, '320-Pistachio Green Med'],
    [215, 237, 204, '369-Pistachio Green Vy Lt'],
    [23, 73, 35, '890-Pistachio Grn Ult V D'],
    [32, 95, 46, '319-Pistachio Grn Vy Dk'],
    [156, 36, 98, '718-Plum'],
    [130, 0, 67, '915-Plum Dark'],
    [197, 73, 137, '3607-Plum Light'],
    [155, 19, 89, '917-Plum Medium'],
    [244, 174, 213, '3609-Plum Ultra Light'],
    [234, 156, 196, '3608-Plum Very Light'],
    [246, 127, 0, '971-Pumpkin'],
    [247, 139, 19, '970-Pumpkin Light'],
    [253, 189, 150, '3825-Pumpkin Pale'],
    [179, 47, 72, '3831-Raspberry Dark'],
    [234, 134, 153, '3833-Raspberry Light'],
    [219, 85, 110, '3832-Raspberry Medium'],
    [145, 53, 70, '777-Raspberry Very Dark'],
    [199, 43, 59, '321-Red'],
    [167, 19, 43, '498-Red Dark'],
    [183, 31, 51, '304-Red Medium'],
    [166, 69, 16, '919-Red-Copper'],
    [130, 52, 10, '918-Red-Copper Dark'],
    [238, 84, 110, '335-Rose'],
    [186, 74, 74, '309-Rose Dark'],
    [251, 173, 180, '3326-Rose Light'],
    [242, 118, 136, '899-Rose Medium'],
    [179, 59, 75, '326-Rose Very Dark'],
    [104, 37, 26, '3857-Rosewood Dark'],
    [186, 139, 124, '3859-Rosewood Light'],
    [150, 74, 63, '3858-Rosewood Med'],
    [248, 202, 200, '3779-Rosewood Ult Vy Lt'],
    [19, 71, 125, '797-Royal Blue'],
    [17, 65, 109, '796-Royal Blue Dark'],
    [14, 54, 92, '820-Royal Blue Very Dark'],
    [245, 173, 173, '760-Salmon'],
    [227, 109, 109, '3328-Salmon Dark'],
    [255, 201, 201, '761-Salmon Light'],
    [241, 135, 135, '3712-Salmon Medium'],
    [191, 45, 45, '347-Salmon Very Dark'],
    [255, 226, 226, '3713-Salmon Very Light'],
    [62, 182, 161, '958-Sea Green Dark'],
    [169, 226, 216, '964-Sea Green Light'],
    [89, 199, 180, '959-Sea Green Med'],
    [47, 140, 132, '3812-Sea Green Vy Dk'],
    [145, 123, 115, '451-Shell Gray Dark'],
    [215, 206, 203, '453-Shell Gray Light'],
    [192, 179, 174, '452-Shell Gray Med'],
    [161, 75, 81, '3721-Shell Pink Dark'],
    [204, 132, 124, '223-Shell Pink Light'],
    [188, 108, 100, '3722-Shell Pink Med'],
    [226, 160, 153, '152-Shell Pink Med Light'],
    [255, 223, 213, '225-Shell Pink Ult Vy Lt'],
    [235, 183, 175, '224-Shell Pink Very Light'],
    [136, 62, 67, '221-Shell Pink Vy Dk'],
    [126, 177, 200, '519-Sky Blue'],
    [172, 216, 226, '3761-Sky Blue Light'],
    [197, 232, 237, '828-Sky Blue Vy Lt'],
    [255, 255, 255, 'B5200-Snow White'],
    [140, 140, 140, '414-Steel Gray Dk'],
    [171, 171, 171, '318-Steel Gray Lt'],
    [243, 206, 117, '3821-Straw'],
    [223, 182, 95, '3820-Straw Dark'],
    [246, 220, 152, '3822-Straw Light'],
    [205, 157, 55, '3852-Straw Very Dark'],
    [203, 144, 81, '436-Tan'],
    [228, 187, 142, '437-Tan Light'],
    [248, 228, 200, '739-Tan Ult Vy Lt'],
    [236, 204, 158, '738-Tan Very Light'],
    [255, 139, 0, '740-Tangerine'],
    [255, 191, 87, '742-Tangerine Light'],
    [255, 163, 43, '741-Tangerine Med'],
    [251, 213, 187, '945-Tawny'],
    [255, 226, 207, '951-Tawny Light'],
    [255, 238, 227, '3770-Tawny Vy Light'],
    [52, 125, 117, '3847-Teal Green Dark'],
    [82, 179, 164, '3849-Teal Green Light'],
    [85, 147, 146, '3848-Teal Green Med'],
    [188, 85, 68, '3830-Terra Cotta'],
    [152, 68, 54, '355-Terra Cotta Dark'],
    [217, 137, 120, '3778-Terra Cotta Light'],
    [197, 106, 91, '356-Terra Cotta Med'],
    [244, 187, 169, '3771-Terra Cotta Ult Vy Lt'],
    [134, 48, 34, '3777-Terra Cotta Vy Dk'],
    [238, 170, 155, '758-Terra Cotta Vy Lt'],
    [228, 180, 104, '728-Topaz'],
    [174, 119, 32, '782-Topaz Dark'],
    [253, 215, 85, '726-Topaz Light'],
    [255, 200, 64, '725-Topaz Med Lt'],
    [206, 145, 36, '783-Topaz Medium'],
    [148, 99, 26, '780-Topaz Ultra Vy Dk'],
    [162, 109, 32, '781-Topaz Very Dark'],
    [255, 241, 175, '727-Topaz Vy Lt'],
    [91, 163, 179, '597-Turquoise'],
    [18, 174, 186, '3844-Turquoise Bright Dark'],
    [6, 227, 230, '3846-Turquoise Bright Light'],
    [4, 196, 202, '3845-Turquoise Bright Med'],
    [72, 142, 154, '3810-Turquoise Dark'],
    [144, 195, 204, '598-Turquoise Light'],
    [54, 105, 112, '3808-Turquoise Ult Vy Dk'],
    [188, 227, 230, '3811-Turquoise Very Light'],
    [63, 124, 133, '3809-Turquoise Vy Dark'],
    [163, 99, 139, '553-Violet'],
    [99, 54, 102, '327-Violet Dark'],
    [219, 179, 203, '554-Violet Light'],
    [92, 24, 78, '550-Violet Very Dark'],
    [230, 204, 217, '153-Violet Very Light'],
    [128, 58, 107, '552-Violet  Medium'],
    [59, 118, 143, '517-Wedgwood Dark'],
    [79, 147, 167, '518-Wedgwood Light'],
    [62, 133, 162, '3760-Wedgwood Med'],
    [28, 80, 102, '311-Wedgwood Ult VyDk'],
    [50, 102, 124, '3842-Wedgwood Vry Dk'],
    [252, 251, 248, 'White-White'],
    [249, 247, 241, '3865-Winter White'],
    [188, 150, 106, '3045-Yellow Beige Dk'],
    [231, 214, 193, '3047-Yellow Beige Lt'],
    [216, 188, 154, '3046-Yellow Beige Md'],
    [167, 124, 73, '167-Yellow Beige V Dk'],
    [204, 217, 177, '3348-Yellow Green Lt'],
    [113, 147, 92, '3347-Yellow Green Med'],
    [228, 236, 212, '772-Yellow Green Vy Lt'],
    [254, 211, 118, '743-Yellow Med'],
    [255, 231, 147, '744-Yellow Pale'],
    [255, 233, 173, '745-Yellow Pale Light'],
    [255, 253, 227, '3823-Yellow Ultra Pale']
  ]},
  'perler': {'dimensions': 0.181102362, colors: [
    // Perler bead colors
    [255, 255, 255, "P01-WHITE"],
    [240, 230, 195, "P02-CREAM"],
    [255, 235, 55,  "P03-YELLOW"],
    [255, 115, 80,  "P04-ORANGE"],
    [205, 70, 90,   "P05-RED"],
    [240, 130, 175, "P06-BUBBLE-GUM"],
    [120, 95, 155,  "P07-PURPLE"],
    [35, 80, 145,   "P08-DARK-BLUE"],
    [45, 130, 200,  "P09-LIGHT-BLUE"],
    [40, 140, 100,  "P10-DARK-GREEN"],
    [75, 195, 180,  "P11-LIGHT-GREEN"],
    [110, 90, 85,   "P12-BROWN"],
    [150, 155, 160, "P17-GREY"],
    [0, 0, 0,       "P18-BLACK"],
    [165, 90, 90,   "P20-RUST"],
    [160, 130, 95,  "P21-LIGHT-BROWN"],
    [250, 205, 195, "P33-PEACH"],
    [205, 165, 135, "P35-TAN"],
    [255, 60, 130,  "P38-MAGENTA"],
    [90, 160, 205,  "P52-PASTEL-BLUE"],
    [135, 210, 145, "P53-PASTEL-GREEN"],
    [155, 135, 205, "P54-PASTEL-LAVENDER"],
    [215, 155, 200, "P55-PASTEL-PINK"],
    [245, 240, 155, "P56-PASTEL-YELLOW"],
    [250, 200, 85,  "P57-CHEDDAR"],
    [160, 215, 225, "P58-TOOTHPASTE"],
    [255, 90, 115,  "P59-HOT-CORAL"],
    [175, 90, 160,  "P60-PLUM"],
    [125, 210, 80,  "P61-KIWI-LIME"],
    [5, 150, 205,   "P62-TURQUOISE"],
    [255, 150, 160, "P63-BLUSH"],
    [85, 125, 185,  "P70-PERIWINKLE"],
    [245, 200, 230, "P79-LIGHT-PINK"],
    [115, 185, 115, "P80-BRIGHT-GREEN"],
    [240, 95, 165,  "P83-PINK"],
    [190, 70, 115,  "P88-RASPBERRY"],
    [240, 150, 110, "P90-BUTTERSCOTCH"],
    [0, 150, 165,   "P91-PARROT-GREEN"],
    [95, 100, 100,  "P92-DARK-GREY"],

    // Hama bead colors
    [250, 240, 195, "H02-CREAM"],
    [255, 215, 90,  "H03-YELLOW"],
    [240, 105, 95,  "H04-ORANGE"],
    [245, 155, 175, "H06-PINK"],
    [35, 85, 160,   "H08-BLUE"],
    [120, 90, 145,  "H07-PURPLE"],
    [25, 105, 180,  "H09-LIGHT-BLUE"],
    [35, 125, 95,   "H10-GREEN"],
    [70, 195, 165,  "H11-LIGHT-GREEN"],
    [100, 75, 80,   "H12-BROWN"],
    [145, 150, 155, "H17-GREY"],
    [170, 85, 80,   "H20-BROWN"],
    [190, 130, 100, "H21-LIGHT-BROWN"],
    [175, 75, 85,   "H22-DARK-RED"],
    [240, 170, 165, "H26-FLESH"],
    [225, 185, 150, "H27-BEIGE"],
    [70, 85, 90,    "H28-DARK-GREEN"],
    [195, 80, 115,  "H29-RASPBERRY"],
    [115, 75, 85,   "H30-BURGUNDY"],
    [105, 160, 175, "H31-TURQUOISE"],
    [255, 95, 200,  "H32-FUCHSIA"],
    [245, 240, 125, "H43-PASTEL-YELLOW"],
    [255, 120, 140, "H44-PASTEL-CORAL"],
    [165, 140, 205, "H45-PASTEL-PURPLE"],
    [80, 170, 225,  "H46-PASTEL-BLUE"],
    [150, 230, 160, "H47-PASTEL-GREEN"],
    [230, 135, 200, "H48-PASTEL-PINK"],
    [240, 175, 95,  "H60-TEDDY-BEAR"],

    // Nabbi bead colors
    [90, 85, 80,    "N02-DARK-BROWN"],
    [105, 75, 80,   "N03-BROWN-MEDIUM"],
    [150, 85, 100,  "N04-WINE-RED"],
    [190, 125, 85,  "N05-BUTTERSCOTCH"],
    [185, 160, 145, "N06-BEIGE"],
    [240, 195, 150, "N07-SKIN"],
    [160, 160, 155, "N08-ASH-GREY"],
    [70, 100, 90,   "N09-DARK-GREEN"],
    [230, 225, 225, "N10-LIGHT-GREY"],
    [115, 90, 155,  "N11-PURPLE"],
    [245, 225, 215, "N12-IVORY"],
    [255, 210, 75,  "N14-YELLOW"],
    [50, 145, 100,  "N16-GREEN"],
    [0, 120, 210,   "N17-BLUE"],
    [245, 200, 190, "N18-LIGHT-PINK"],
    [215, 65, 85,   "N19-LIGHT-RED"],
    [210, 155, 125, "N20-LIGHT-BROWN"],
    [255, 245, 175, "N21-LIGHT-YELLOW"],
    [55, 170, 100,  "N22-PEARL-GREEN"],
    [90, 170, 235,  "N23-PASTEL-BLUE"],
    [200, 185, 240, "N24-LILAC"],
    [255, 120, 165, "N25-OLD-ROSE"],
    [255, 185, 150, "N26-LIGHT-ORANGE"],
    [145, 105, 100, "N27-BROWN"],
    [160, 205, 245, "N28-LIGHT-BLUE"],
    [225, 160, 85,  "N29-PEARL-ORANGE"],
    [200, 200, 120, "N30-OLIVE"]
  ]},
  'simple': {'dimensions': 0, 'colors': [
    [0, 0, 0,       "Black"],
    [255, 255, 255, "White"],
    [255, 0, 0,     "Red"],
    [0, 255, 0,     "Blue"],
    [0, 0, 255,     "Green"]
  ]}
};
