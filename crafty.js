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
    for (var i = 0; i < palette.colors.length; i++) {
      var c = palette.colors[i];
      var hc = hex(c);
      if (hc == hex(p)) { // HACK
        st.innerText = c[3] + ' @ (' + x + ','+ y + ')';
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
    [255, 255, 255, 'Blanc-white'],
    [255, 234, 217, 'ecru-ecru'],
    [159, 56, 69, '150-Dusty-Rose-UlVyLt'],
    [242, 188, 197, '151-Dusty-Rose-VyLt'],
    [207, 162, 150, '152-Shell-pink-Md-Lt'],
    [222, 188, 217, '153-Violet-Vy-Lt'],
    [77, 46, 61, '154-Grape-Vy-Dk'],
    [144, 139, 195, '155-Blue-Violet-Md-Dk'],
    [139, 154, 197, '156-Blue-Violet-Md-Lt'],
    [171, 194, 222, '157-Cornflower-Blue-Vy-Lt'],
    [70, 80, 130, '158-Cornflower-Blue-VD'],
    [167, 180, 205, '159-Gray-Blue-Lt'],
    [130, 144, 174, '160-Gray-Blue-Md'],
    [102, 117, 148, '161-Gray-Blue'],
    [189, 219, 230, '162-Blue-UlVyLt'],
    [86, 149, 113, '163-Celadon-Green-Md'],
    [159, 204, 141, '164-Forest-Breen-Lt'],
    [218, 216, 120, '165-Moss-Green-Vy-Lt'],
    [191, 187, 32, '166-Moss-Green-Md-Lt'],
    [159, 132, 71, '167-Yellow-Beige-Vy-Dk'],
    [180, 195, 193, '168-Pewter-Vy-Lt'],
    [139, 154, 148, '169-Pewter-Lt'],
    [160, 97, 157, '208-Lavender-VY-Dk'],
    [191, 128, 181, '209-Lavender-DK'],
    [205, 158, 208, '210-Lavender-MD'],
    [216, 169, 225, '211-Lavender-LT'],
    [160, 71, 68, '221-Shell-Pink-VY-Dk'],
    [211, 124, 125, '223-Shell-Pink-LT'],
    [232, 171, 158, '224-Shell-Pink-VY-Lt'],
    [243, 213, 202, '225-Shell-Pink-ULT-VY-L'],
    [126, 36, 20, '300-Mahogany-VY-Dk'],
    [190, 98, 63, '301-Mahogany-MD'],
    [185, 0, 44, '304-Christmas-Red-MD'],
    [243, 208, 59, '307-Lemon'],
    [187, 12, 68, '309-Rose-DP'],
    [0, 0, 0, '310-Black'],
    [6, 39, 110, '311-Navy-Blue-MD'],
    [26, 81, 117, '312-Navy-Blue-LT'],
    [147, 83, 98, '315-Antique-Mauve-VY-Dk'],
    [188, 124, 139, '316-Antique-Mauve-MD'],
    [95, 95, 102, '317-Pewter-Grey'],
    [151, 150, 157, '318-Steel-Grey-Lt'],
    [57, 90, 61, '319-Pistachio-Green-VY-Dk'],
    [87, 133, 101, '320-Pistachio-Green-MD'],
    [225, 0, 71, '321-Christmas-Red'],
    [47, 104, 141, '322-Navy-Blue-VY-Lt'],
    [195, 14, 70, '326-Rose-VY-DP'],
    [115, 52, 105, '327-Violet-DK'],
    [121, 86, 141, '333-Blue-Violet-VY-Dk'],
    [70, 124, 161, '334-Baby-Blue-MD'],
    [235, 110, 126, '335-Rose'],
    [14, 36, 104, '336-Navy-Blue'],
    [136, 145, 187, '340-Blue-Violet-MD'],
    [175, 178, 212, '341-Blue-Violet-LT'],
    [205, 20, 60, '347-Salmon-VY-Dk'],
    [216, 23, 23, '349-Coral-DK'],
    [217, 65, 68, '350-Coral-MD'],
    [231, 95, 95, '351-Coral'],
    [251, 126, 126, '352-Coral-LT'],
    [234, 167, 154, '353-Peach-Flesh'],
    [171, 52, 50, '355-Terra-Cotta-DK'],
    [196, 98, 89, '356-Terra-Cotta-MD'],
    [54, 106, 77, '367-Pistachio-Green-DK'],
    [124, 161, 118, '368-Pistachio-Green-LT'],
    [184, 209, 170, '369-Pistachio-Green-VY-Lt'],
    [157, 130, 92, '370-Mustard-Md'],
    [181, 157, 107, '371-Mustard'],
    [178, 166, 142, '372-Mustard-Lt'],
    [150, 62, 44, '400-Mahogany-DK'],
    [246, 142, 94, '402-Mahogany-VY-Lt'],
    [176, 110, 95, '407-Sportsman-Flsh-VY-D'],
    [74, 74, 81, '413-Pewter-Grey-Dk'],
    [119, 119, 126, '414-Steel-Grey-Dk'],
    [174, 174, 181, '415-Pearl-Grey'],
    [151, 91, 44, '420-Hazel-Nut-Brown-DK'],
    [202, 139, 89, '422-Hazel-Nut-Brown-LT'],
    [122, 53, 24, '433-Brown-MD'],
    [149, 80, 36, '434-Brown-LT'],
    [171, 97, 53, '435-Brown-VY-Lt'],
    [195, 121, 77, '436-Tan'],
    [226, 161, 116, '437-Tan-LT'],
    [247, 187, 47, '444-Lemon-DK'],
    [255, 248, 151, '445-Lemon-LT'],
    [139, 115, 122, '451-Shell-Grey-Dk'],
    [160, 143, 150, '452-Shell-Grey-Md'],
    [189, 174, 181, '453-Shell-Grey-Lt'],
    [77, 110, 18, '469-Avocado-Green'],
    [101, 136, 33, '470-Avocado-Green-LT'],
    [138, 158, 70, '471-Avocado-Green-VY-Lt'],
    [191, 205, 114, '472-Avocado-Green-ULT-Lt'],
    [175, 0, 39, '498-Christmas-Red-LT'],
    [40, 74, 69, '500-Blue-Green-VY-Dk'],
    [71, 107, 100, '501-Blue-Green-DK'],
    [95, 136, 124, '502-Blue-Green'],
    [112, 157, 141, '503-Blue-Green-MD'],
    [174, 202, 184, '504-Blue-Green-LT'],
    [36, 94, 124, '517-Wedgewood-MD'],
    [98, 148, 174, '518-Wedgewood-LT'],
    [143, 180, 201, '519-Sky-Blue'],
    [85, 93, 74, '520-Fern-Green-DK'],
    [123, 131, 112, '522-Fern-Green'],
    [156, 163, 145, '523-Fern-Green-LT'],
    [171, 178, 162, '524-Fern-Green-VY-Lt'],
    [99, 84, 88, '535-Ash-Grey-Vy-Lt'],
    [255, 225, 193, '543-Beige-Brown-UL-VY-L'],
    [114, 75, 114, '550-Violet-VY-Lt'],
    [144, 92, 144, '552-Violet-MD'],
    [168, 113, 168, '553-Violet'],
    [211, 148, 201, '554-Violet-LT'],
    [58, 102, 82, '561-Jade-VY-Dk'],
    [77, 125, 105, '562-Jade-MD'],
    [134, 178, 157, '563-Jade-LT'],
    [145, 193, 174, '564-Jade-VY-Lt'],
    [110, 114, 2, '580-Moss-Green-DK'],
    [131, 139, 7, '581-Moss-Green'],
    [24, 174, 185, '597-Turquoise'],
    [74, 225, 225, '598-Turquoise-LT'],
    [228, 63, 98, '600-Cranberry-VY-Dk'],
    [219, 79, 116, '601-Cranberry-DK'],
    [235, 95, 132, '602-Cranberry-MD'],
    [255, 145, 213, '603-Cranberry'],
    [252, 172, 222, '604-Cranberry-LT'],
    [255, 178, 228, '605-Cranberry-VY-Lt'],
    [228, 71, 0, '606-Bright-Orange-Red'],
    [255, 107, 0, '608-Bright-Orange'],
    [120, 88, 59, '610-Drab-Brown-Vy-Dk'],
    [144, 112, 83, '611-Drab-Brown-Dk'],
    [182, 150, 121, '612-Drab-Brown-Md'],
    [203, 181, 158, '613-Drab-Brown-Lt'],
    [140, 75, 62, '632-Negro-Flesh-MD'],
    [119, 116, 110, '640-Beige-Grey-Vy-Dk'],
    [136, 143, 136, '642-Beige-Grey-Dk'],
    [193, 187, 175, '644-Beige-Grey-MD'],
    [70, 76, 73, '645-Beaver-Grey-Vy-Dk'],
    [98, 98, 98, '646-Beaver-Grey-DK'],
    [126, 125, 129, '647-Beaver-Grey-Md'],
    [169, 163, 163, '648-Beaver-Grey-LT'],
    [228, 0, 81, '666-Christmas-Red-LT'],
    [229, 188, 116, '676-Old-Gold-LT'],
    [249, 217, 174, '677-Old-Gold-VY-Lt'],
    [199, 128, 36, '680-Old-Gold-DK'],
    [0, 104, 0, '699-Chirstmas-Green'],
    [0, 119, 0, '700-Christmas-Green-BRT'],
    [26, 125, 62, '701-Christmas-Green-LT'],
    [60, 141, 67, '702-Kelly-Green'],
    [77, 165, 84, '703-Chartreuse'],
    [107, 181, 97, '704-Chartreuse-BRT'],
    [255, 238, 216, '712-Cream'],
    [231, 107, 196, '718-Plum'],
    [225, 94, 0, '720-Orange-Spice-DK'],
    [250, 111, 50, '721-Orange-Spice-MD'],
    [252, 136, 81, '722-Orange-Spice-LT'],
    [243, 181, 0, '725-Topaz'],
    [249, 205, 70, '726-Topaz-LT'],
    [249, 228, 128, '727-Topaz-VY-Lt'],
    [222, 151, 68, '729-Old-Gold-MD'],
    [108, 100, 24, '730-Olive-Green-VY-Dk'],
    [117, 109, 33, '731-Olive-Green-DK'],
    [127, 119, 43, '732-Olive-Green'],
    [170, 162, 86, '733-Olive-Green-MD'],
    [170, 162, 86, '734-Olive-Green-LT'],
    [224, 178, 134, '738-Tan-VY-Lt'],
    [243, 211, 182, '739-Tan-ULT-Vy-Lt'],
    [254, 130, 12, '740-Tangerine'],
    [250, 142, 5, '741-Tangerine-MD'],
    [255, 178, 30, '742-Tangerine-LT'],
    [254, 199, 18, '743-Yellow-MD'],
    [255, 211, 130, '744-Yellow-PALE'],
    [255, 234, 169, '745-Yellow-LT-PALE'],
    [244, 242, 221, '746-Off-White'],
    [175, 222, 225, '747-Sky-Blue-VY-Lt'],
    [238, 174, 163, '754-Peach-Flesh-LT'],
    [238, 162, 145, '758-Terra-Cotta-VY-Lt'],
    [242, 136, 144, '760-Salmon'],
    [251, 170, 183, '761-Salmon-LT'],
    [205, 205, 209, '762-Pearl-Grey-Vy-Lt'],
    [188, 211, 157, '772-Pine-Green--LT'],
    [205, 223, 225, '775-Baby-Blue-VY-Lt'],
    [255, 195, 205, '776-Pink-MD'],
    [218, 174, 179, '778-Antique-Mauve-VY-Lt'],
    [172, 86, 4, '780-Topaz-ULT-Vy-Dk'],
    [187, 103, 0, '781-Topaz-VY-Dk'],
    [202, 115, 0, '782-Topaz-DK'],
    [225, 133, 21, '783-Topaz-MD'],
    [42, 53, 97, '791-Cornflower-Blue-VYD'],
    [50, 83, 125, '792-Cornflower-Blue-DK'],
    [110, 121, 158, '793-Cornflower-Blue-MD'],
    [124, 138, 167, '794-Cornflower-Blue-LT'],
    [44, 67, 122, '796-Royal-Blue-DK'],
    [47, 74, 130, '797-Royal-Blue'],
    [80, 101, 158, '798-Delft-DK'],
    [116, 157, 188, '799-Delft-MD'],
    [185, 215, 218, '800-Delft-PALE'],
    [104, 57, 22, '801-Coffee-Brown-DK'],
    [44, 73, 111, '803-Baby-Blue-UL-Vy-Dk'],
    [65, 133, 154, '806-Peacock-Blue-DK'],
    [85, 153, 174, '807-Peacock-Blue'],
    [145, 172, 213, '809-Delft'],
    [117, 171, 205, '813-Blue-LT'],
    [122, 0, 32, '814-Garnet-DK'],
    [159, 0, 49, '815-Garnet-MD'],
    [169, 0, 50, '816-Garnet'],
    [216, 7, 7, '817-Coral-Red-VY-Dk'],
    [249, 222, 232, '818-Baby-Pink'],
    [255, 231, 225, '819-Baby-Pink-LT'],
    [29, 52, 104, '820-Royal-Blue-VY-Dk'],
    [222, 217, 209, '822-Beige-Grey-LT'],
    [0, 27, 92, '823-Navy-Blue-DK'],
    [33, 89, 139, '824-Blue-VY-Dk'],
    [44, 106, 146, '825-Blue-DK'],
    [70, 128, 170, '826-Blue-MD'],
    [164, 184, 219, '827-Blue-VY-Lt'],
    [188, 215, 225, '828-Blue-ULT-Vy-Lt'],
    [188, 215, 225, '829-Golden-Olive-VY-Dk'],
    [133, 96, 23, '830-Golden-Olive-DK'],
    [150, 113, 40, '831-Golden-Olive-MD'],
    [144, 120, 51, '832-Golden-Olive'],
    [166, 149, 69, '833-Golden-Olive-LT'],
    [198, 171, 93, '834-Golden-Olive-VY-Lt'],
    [98, 42, 0, '838-Beige-Brown-VY-Dk'],
    [104, 53, 30, '839-Beige-Brown-DK'],
    [154, 95, 71, '840-Beige-Brown-MD'],
    [184, 139, 122, '841-Beige-Brown-LT'],
    [222, 187, 163, '842-Beige-Brown-VY-Lt'],
    [56, 62, 63, '844-Beaver-Brown-ULT-D'],
    [115, 74, 24, '869-Hazel-Nut-Brown-VY-Dk'],
    [42, 79, 46, '890-Pistachio-Green-ULT-D'],
    [234, 68, 74, '891-Carnation-DK'],
    [255, 83, 94, '892-Carnation-MD'],
    [247, 114, 135, '893-Carnation-LT'],
    [255, 142, 159, '894-Carnation-VY-Lt'],
    [56, 81, 6, '895-Hunter-Green-VY-Dk'],
    [95, 45, 9, '898-Coffee-Brown-VY-Dk'],
    [255, 148, 181, '899-Rose-MD'],
    [213, 77, 0, '900-Burnt-Orange-DK'],
    [136, 56, 67, '902-Granet-VY-Dk'],
    [15, 106, 0, '904-Parrot-Green-VY-Dk'],
    [22, 122, 21, '905-Parrot-Green-DK'],
    [102, 142, 15, '906-Parrot-Green-MD'],
    [136, 180, 53, '907-Parrot-Green-LT'],
    [30, 101, 60, '909-Emerald-Green-VY-Dk'],
    [37, 108, 67, '910-Emerald-Green-DK'],
    [30, 128, 77, '911-Emerald-Green-MD'],
    [47, 139, 101, '912-Emerald-Green-LT'],
    [104, 173, 124, '913-Nile-Green-MD'],
    [181, 40, 122, '915-Plum-DK'],
    [219, 83, 154, '917-Plum-MD'],
    [139, 34, 0, '918-Red-Copper-DK'],
    [160, 44, 0, '919-Red-Copper'],
    [171, 60, 0, '920-Copper-MD'],
    [190, 79, 0, '921-Copper'],
    [206, 91, 0, '922-Copper-LT'],
    [77, 83, 92, '924-Grey-Green--VY-Dk'],
    [121, 136, 134, '926-Grey-Green-LT'],
    [170, 178, 174, '927-Grey-Green-LT'],
    [198, 205, 202, '928-Grey-Green--VY-Lt'],
    [50, 92, 113, '930-Antique-Blue-DK'],
    [125, 130, 142, '931-Antique-Blue-MD'],
    [136, 148, 166, '932-Antique-Blue-LT'],
    [40, 62, 0, '934-Black-Avocado-Green'],
    [47, 74, 0, '935-Avocado-Green-DK'],
    [57, 80, 0, '936-Avocado-Green--VY-D'],
    [74, 94, 0, '937-Avocado-Green-MD'],
    [92, 38, 0, '938-Coffee-Brown-ULT-Dk'],
    [4, 50, 89, '939-Navy-Blue-Vy-Dk'],
    [145, 116, , '943-Aquamarine-MD'],
    [252, 196, 174, '945-Flesh-MD'],
    [238, 94, 3, '946-Burnt-Orange-MD'],
    [255, 95, 0, '947-Burnt-Orange'],
    [255, 95, 0, '948-Peach-Flesh-VY-Lt'],
    [222, 178, 166, '950-Sportsman-Flesh'],
    [250, 220, 205, '951-Flesh'],
    [178, 219, 186, '955-Nile-Green-LT'],
    [250, 95, 116, '956-Geranium'],
    [252, 160, 178, '957-Gernanium-PALE'],
    [10, 162, 148, '958-Sea-Green-DK'],
    [94, 190, 178, '959-Sea-Green-MD'],
    [208, 93, 116, '961-Dusty-Rose-DK'],
    [252, 208, 212, '963-Dusty-Rose-ULT-VY-L'],
    [121, 219, 193, '964-Sea-Green-LT'],
    [146, 193, 167, '966-Baby-Green-MD'],
    [250, 107, 0, '970-Pumpkin-LT'],
    [250, 107, 0, '971-Pumpkin'],
    [255, 157, 39, '972-Canary-DP'],
    [255, 208, 84, '973-Canary-BRT'],
    [150, 69, 18, '975-Golden-Brown-DK'],
    [213, 119, 30, '976-Golden-Brown-MD'],
    [222, 139, 62, '977-Golden-Brown-LT'],
    [64, 95, 49, '986-Forest-Green-VY-Dk'],
    [80, 105, 53, '987-Forest-Green-DK'],
    [111, 138, 84, '988-Forest-Green-MD'],
    [128, 164, 107, '989-Forest-Green'],
    [44, 114, 96, '991-Aquamarine-DK'],
    [91, 148, 128, '992-Aquamarine'],
    [119, 176, 154, '993-Aquamarine-LT'],
    [0, 97, 193, '995-Electric-Blue-DK'],
    [161, 211, , '996-Electric-Blue-MD'],
    [125, 109, 66, '3011-Khaki-Green-DK'],
    [158, 147, 104, '3012-Khaki-Green-MD'],
    [185, 174, 131, '3013-Khaki-Green-LT'],
    [59, 59, 55, '3021-Brown-Grey-Vy-Dk'],
    [135, 136, 131, '3022-Brown-Grey-Md'],
    [165, 166, 161, '3023-Brown-Grey-Lt'],
    [196, 195, 188, '3024-Brown-Grey-Vy-Lt'],
    [95, 53, 39, '3031-Mocha-Brown-VY-Dk'],
    [154, 142, 125, '3032-Mocha-Brown-MD'],
    [231, 216, 216, '3033-Mocha-Brown-VY-Lt'],
    [147, 124, 144, '3041-Antique-Violet-MD'],
    [185, 168, 185, '3042-Antique-Violet-LT'],
    [181, 128, 65, '3045-Yellow-Beige-DK'],
    [212, 178, 116, '3046-Yellow-Beige-MD'],
    [221, 201, 174, '3047-Yellow-Beige-LT'],
    [85, 110, 74, '3051-Green-Grey-DK'],
    [106, 121, 92, '3052-Green-Grey--MD'],
    [125, 141, 118, '3053-Green-Grey'],
    [191, 125, 110, '3064-Sportsman-Flesh-VY-D'],
    [200, 202, 202, '3072-Beaver-Grey-Vy-Lt'],
    [248, 228, 142, '3078-Golden-Yellow-VY-Lt'],
    [179, 202, 218, '3325-Baby-Blue-LT'],
    [245, 174, 186, '3326-Rose-LT'],
    [218, 70, 87, '3328-Salmon-DK'],
    [255, 134, 107, '3340-Apricot-MD'],
    [255, 162, 134, '3341-Apricot'],
    [68, 98, 21, '3345-Hunter-Green-DK'],
    [86, 113, 47, '3346-Hunter-Green'],
    [108, 133, 83, '3347-Yellow-Green-MD'],
    [154, 178, 104, '3348-Yellow-Green-LT'],
    [200, 41, 90, '3350-Dusty-Rose-ULT-Dk'],
    [234, 116, 145, '3354-Dusty-Rose-LT'],
    [69, 83, 36, '3362-Pine-Green-DK'],
    [93, 107, 56, '3363-Pine-Green-MD'],
    [138, 152, 101, '3364-Pine-Green'],
    [65, 18, 2, '3371-Black-Brown'],
    [222, 125, 181, '3607-Plum-LT'],
    [234, 178, 210, '3608-Plum-VY-Lt'],
    [252, 169, 228, '3609-Plum-ULT-Lt'],
    [148, 28, 85, '3685-Mauve-DK'],
    [204, 94, 121, '3687-Mauve'],
    [225, 155, 172, '3688-Mauve-MD'],
    [255, 163, 219, '3689-Mauve-LT'],
    [242, 92, 115, '3705-Melon-DK'],
    [255, 141, 148, '3706-Melon-MD'],
    [252, 151, 172, '3708-Melon-LT'],
    [238, 107, 114, '3712-Salmon-MD'],
    [255, 194, 204, '3713-Salmon-VY-Lt'],
    [252, 176, 180, '3716-Dusty-Rose-VY-Lt'],
    [170, 81, 78, '3721-Shell-Pink-DK'],
    [187, 98, 95, '3722-Shell-Pink-MD'],
    [150, 86, 101, '3726-Antique-Mauve-DK'],
    [205, 150, 158, '3727-Antique-Mauve-LT'],
    [228, 74, 122, '3731-Dusty-Rose-VY-Dk'],
    [234, 111, 142, '3733-Dusty-Rose'],
    [111, 93, 111, '3740-Antique-Violet-DK'],
    [204, 197, 204, '3743-Antique-Violet-VY-L'],
    [133, 116, 172, '3746-Blue-Violet-DK'],
    [196, 213, 248, '3747-Blue-Violet-VY-Lt'],
    [50, 77, 92, '3750-Antique-Blue-VY-Dk'],
    [154, 166, 181, '3752-Antique-Blue-VY-Lt'],
    [157, 166, 181, '3753-Antique-Blue-ULT-Vy-Lt'],
    [128, 164, 195, '3755-Baby-Blue'],
    [218, 234, 238, '3756-Baby-Blue-ULT-Vy-Lt'],
    [74, 124, 150, '3760-Wedgewood'],
    [164, 201, 218, '3761-Sky-Blue-LT'],
    [34, 114, 134, '3765-Peacock-Blue-VY-Dk'],
    [109, 177, 195, '3766-Peacock-Blue-LT'],
    [105, 113, 113, '3768-Grey-Green-DK'],
    [245, 228, 216, '3770-Flesh-VY-Lt'],
    [232, 181, 143, '3771-Terra-Cotta-UlVyLt'],
    [164, 99, 86, '3772-Negro-Flesh'],
    [202, 142, 130, '3773-Sportsman-Flesh-MD'],
    [234, 200, 189, '3774-Sportsman-Flesh-VY-L'],
    [228, 125, 86, '3776-Mahogony-LT'],
    [148, 53, 47, '3777-Terra-Cotta-VY-Dk'],
    [213, 121, 107, '3778-Terra-Cotta-LT'],
    [249, 185, 181, '3779-Terra-Cotta-ULT-VY-L'],
    [116, 71, 59, '3781-Mocha-Brown-DK'],
    [197, 181, 167, '3782-Mocho-Brown-LT'],
    [90, 90, 86, '3787-Brown-Grey-Dk'],
    [116, 92, 80, '3790-Beige-Grey-ULT-Dk'],
    [59, 56, 61, '3799-Pewter-Grey-Vy-Dk'],
    [230, 85, 107, '3801-Christmas-Red-lt'],
    [130, 66, 81, '3802-Antique-Mauve-vy-Dk'],
    [154, 34, 91, '3803-Mauve-MD'],
    [232, 82, 137, '3804-Cyclamen-Pink-DK'],
    [243, 101, 150, '3805-Cyclamen-Pink'],
    [244, 117, 171, '3806-Cyclamen-Pink-LT'],
    [86, 97, 134, '3807-Cornflower-Blue'],
    [9, 104, 113, '3808-Turquoise-ultra-vydk'],
    [139, 149, , '3809-Turquoise-vy-Dk'],
    [148, 157, , '3810-Turquoise-Dk'],
    [158, 235, 228, '3811-Turquoise-vy-Lt'],
    [141, 129, , '3812-Sea-Green-vy-Dk'],
    [136, 177, 165, '3813-Blue-Green-Lt'],
    [64, 124, 105, '3814-Aquamarine'],
    [90, 125, 91, '3815-Celadon-Green-Dk'],
    [114, 157, 133, '3816-Celadon-Green-Md'],
    [141, 181, 163, '3817-Celadon-Green-Lt'],
    [0, 94, 55, '3818-Emerald-Green-UlVYDK'],
    [186, 190, 62, '3819-Moss-Green-Lt'],
    [243, 169, 84, '3820-Straw-Dk'],
    [252, 184, 83, '3821-Straw'],
    [255, 202, 98, '3822-Straw-Lt'],
    [255, 238, 184, '3823-Yellow-Ultra-Pale'],
    [255, 184, 181, '3824-Apricot-Lt'],
    [255, 171, 131, '3825-Pumpkin-pale'],
    [172, 86, 21, '3826-Golden-Brown'],
    [219, 166, 107, '3827-Golden-Brown-pale'],
    [177, 117, 70, '3828-Hazelnut-Brown'],
    [184, 111, 10, '3829-Old-Gold-vy-Dk'],
    [178, 71, 71, '3830-Terra-Cotta-Md'],
    [140, 35, 44, '3831-Raspberry-Dk'],
    [107, 131, 190, '3838-Lavender-Blue-Dk'],
    [130, 154, 206, '3839-Lavender-Blue-Md'],
    [168, 196, 229, '3840-Lavender-Blue-Lt'],
    [184, 213, 226, '3841-Baby-Blue-Pale'],
    [44, 95, 135, '3842-Wedgewood-Dk'],
    [126, 201, , '3843-Electric-Blue'],
    [141, 188, , '3844-Bright-turquoise-Dk'],
    [181, 217, , '3845-Bright-turquoise-Md'],
    [23, 197, 226, '3846-Bright-turquoise-Lt'],
    [29, 111, 102, '3847-Teal-Green-Dk'],
    [60, 143, 133, '3848-Teal-Green-Md'],
    [99, 171, 163, '3849-Teal-Green-Lt'],
    [16, 135, 105, '3850-Bright-Green-Dk'],
    [72, 174, 147, '3851-Bright-Green'],
    [203, 162, 37, '3852-Straw-Vy-Dk'],
    [227, 142, 57, '3853-Autumn-Gold-Dk'],
    [242, 179, 92, '3854-Autumn-Gold-Md'],
    [240, 215, 136, '3855-Autumn-Gold-Lt'],
    [239, 198, 141, '3856-Mahogany-Ul-Vy-Lt'],
    [70, 35, 32, '3857-Rosewood-Dk'],
    [143, 93, 76, '3858-Rosewood-Md'],
    [193, 141, 118, '3859-Rosewood-Lt'],
    [140, 117, 103, '3860-Cocoa'],
    [167, 147, 136, '3861-Cocoa-Lt'],
    [137, 114, 76, '3862-Mocha-Beige-Dk'],
    [163, 138, 101, '3863-Mocha-Beige-Md'],
    [195, 177, 144, '3864-Mocha-Beige-Lt'],
    [227, 228, 212, '3866-Mocha-Brown-UlVyLt'],
    [70, 35, 32, '3857-Rosewood-Dk'],
    [143, 93, 76, '3858-Rosewood-Md'],
    [193, 141, 118, '3859-Rosewood-Lt'],
    [140, 117, 103, '3860-Cocoa'],
    [167, 147, 136, '3861-Cocoa-Lt'],
    [137, 114, 76, '3862-Mocha-Beige-Dk'],
    [163, 138, 101, '3863-Mocha-Beige-Md'],
    [195, 177, 144, '3864-Mocha-Beige-Lt'],
    [227, 228, 212, '3866-Mocha-Brown-UlVyLt']
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
