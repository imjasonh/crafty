package perlerize

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"net/http"
	"sort"
	"strconv"
	"text/template"
)

const (
	rgb8to16          = 0x101       // Multiply an 8-bit RGB value to 16-bit
	perlerWidthInches = 0.181102362 // Inches width of a Perler bead

	bufSize = 2 << 17 // 256K
)

const perlerForm = `
<html><body>
  <form id="form" method="POST" action="/" enctype="multipart/form-data">
    <label for="file">Select a PNG file</label>
    <input type="file" name="file" id="file" accept="image/png"></input>
  </form>
  <script type="text/javascript">
    document.getElementById("file").onchange = function() {
      document.getElementById("form").submit();
    };
  </script>
</body></html>
`

var perlerTmpl = template.Must(template.New("tmpl").Parse(`
<html><body>
  <a href="/">&laquo; Back</a><br />

  <img src="{{.DataURI}}" /><br />

  <p>Physical dimensions: {{.PhysDim}}</p>

  <p>{{.Total}} total beads</p>
  <table>
    {{range .Counts}}
    <tr><td>{{.Key}}</td><td>{{.Val}}</td>
    {{end}}
  </table>
</body></html>
`))

func init() {
	http.HandleFunc("/", perlerHandler)
}

func perlerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		w.Write([]byte(perlerForm))
		return
	}

	mpf, _, err := r.FormFile("file")
	if err != nil {
		log.Fatal(err)
	}
	defer mpf.Close()

	img, err := png.Decode(mpf)
	if err != nil {
		log.Fatal(err)
	}

	// Make a palette out of all the possible bead colors
	var palette color.Palette
	for k, _ := range paletteMap {
		palette = append(palette, k)
	}
	paletted := palettedImage{img, palette}

	// Make a resized image
	resized := resizedImage{paletted, 5, true}

	buf := bytes.NewBuffer(make([]byte, 0, bufSize))
	png.Encode(buf, resized)
	dataURI := fmt.Sprintf("data:image/png;base64,%s", base64.StdEncoding.EncodeToString(buf.Bytes()))

	// Physical dimensions
	str := func(x int) string {
		return strconv.FormatFloat(float64(x)*perlerWidthInches, 'g', 3, 64)
	}
	physX := str(img.Bounds().Max.X)
	physY := str(img.Bounds().Max.Y)

	// Total and per-bead counts
	var total uint32
	colors := make(map[string]uint32)
	for i := paletted.Bounds().Min.X; i < paletted.Bounds().Max.X; i++ {
		for j := paletted.Bounds().Min.Y; j < paletted.Bounds().Max.Y; j++ {
			c := paletted.At(i, j)
			_, _, _, a := c.RGBA()
			if a == 0 {
				continue
			}
			colors[paletteMap[c]]++
			total++
		}
	}
	perlerTmpl.Execute(w, struct {
		DataURI string
		Total   uint32
		PhysDim string
		Counts  []pair
	}{
		DataURI: dataURI,
		Total:   total,
		PhysDim: fmt.Sprintf("%s\" x %s\"", physX, physY),
		Counts:  sortMap(colors),
	})
}

type resizedImage struct {
	orig      image.Image
	factor    int
	delineate bool
}

func (r resizedImage) ColorModel() color.Model {
	return r.orig.ColorModel()
}

func (r resizedImage) Bounds() image.Rectangle {
	return image.Rectangle{r.orig.Bounds().Min, image.Point{
		X: r.orig.Bounds().Max.X * r.factor,
		Y: r.orig.Bounds().Max.Y * r.factor,
	}}
}

func (r resizedImage) At(x, y int) color.Color {
	oc := r.orig.At(x/r.factor, y/r.factor)
	if _, _, _, a := oc.RGBA(); a == 0 {
		return color.Transparent
	}
	if r.delineate && (x%r.factor == 0 || y%r.factor == 0) {
		return color.Gray{0}
	}
	return r.orig.At(x/r.factor, y/r.factor)
}

type palettedImage struct {
	orig    image.Image
	palette color.Palette
}

func (p palettedImage) ColorIndexAt(x, y int) uint8 {
	return uint8(p.palette.Index(p.orig.At(x, y)))
}
func (p palettedImage) At(x, y int) color.Color {
	return convert(p.palette, p.orig.At(x, y))
}
func (p palettedImage) Bounds() image.Rectangle {
	return p.orig.Bounds()
}
func (p palettedImage) ColorModel() color.Model {
	return color.ModelFunc(func(in color.Color) color.Color {
		return convert(p.palette, in)
	})
}
func convert(p color.Palette, c color.Color) color.Color {
	_, _, _, a := c.RGBA()
	if a == 0 {
		return color.Transparent
	}
	return p.Convert(c)
}

type myColor struct {
	r, g, b uint32
}

func (m myColor) RGBA() (r, g, b, a uint32) {
	return m.r * rgb8to16,
		m.g * rgb8to16,
		m.b * rgb8to16,
		255 * rgb8to16
}
func col(r, g, b uint32) color.Color {
	return myColor{r, g, b}
}

// Map of available Perler bead colors to their name
// From https://sites.google.com/site/degenatrons/other-stuff/bead-pattern-generator
var paletteMap = map[color.Color]string{
	// Perler bead colors
	col(255, 255, 255): "P01-WHITE",
	col(240, 230, 195): "P02-CREAM",
	col(255, 235, 55):  "P03-YELLOW",
	col(255, 115, 80):  "P04-ORANGE",
	col(205, 70, 90):   "P05-RED",
	col(240, 130, 175): "P06-BUBBLE-GUM",
	col(120, 95, 155):  "P07-PURPLE",
	col(35, 80, 145):   "P08-DARK-BLUE",
	col(45, 130, 200):  "P09-LIGHT-BLUE",
	col(40, 140, 100):  "P10-DARK-GREEN",
	col(75, 195, 180):  "P11-LIGHT-GREEN",
	col(110, 90, 85):   "P12-BROWN",
	col(150, 155, 160): "P17-GREY",
	col(0, 0, 0):       "P18-BLACK",
	col(165, 90, 90):   "P20-RUST",
	col(160, 130, 95):  "P21-LIGHT-BROWN",
	col(250, 205, 195): "P33-PEACH",
	col(205, 165, 135): "P35-TAN",
	col(255, 60, 130):  "P38-MAGENTA",
	col(90, 160, 205):  "P52-PASTEL-BLUE",
	col(135, 210, 145): "P53-PASTEL-GREEN",
	col(155, 135, 205): "P54-PASTEL-LAVENDER",
	col(215, 155, 200): "P55-PASTEL-PINK",
	col(245, 240, 155): "P56-PASTEL-YELLOW",
	col(250, 200, 85):  "P57-CHEDDAR",
	col(160, 215, 225): "P58-TOOTHPASTE",
	col(255, 90, 115):  "P59-HOT-CORAL",
	col(175, 90, 160):  "P60-PLUM",
	col(125, 210, 80):  "P61-KIWI-LIME",
	col(5, 150, 205):   "P62-TURQUOISE",
	col(255, 150, 160): "P63-BLUSH",
	col(85, 125, 185):  "P70-PERIWINKLE",
	col(245, 200, 230): "P79-LIGHT-PINK",
	col(115, 185, 115): "P80-BRIGHT-GREEN",
	col(240, 95, 165):  "P83-PINK",
	col(190, 70, 115):  "P88-RASPBERRY",
	col(240, 150, 110): "P90-BUTTERSCOTCH",
	col(0, 150, 165):   "P91-PARROT-GREEN",
	col(95, 100, 100):  "P92-DARK-GREY",

	// Hama bead colors
	col(250, 240, 195): "H02-CREAM",
	col(255, 215, 90):  "H03-YELLOW",
	col(240, 105, 95):  "H04-ORANGE",
	col(245, 155, 175): "H06-PINK",
	col(35, 85, 160):   "H08-BLUE",
	col(120, 90, 145):  "H07-PURPLE",
	col(25, 105, 180):  "H09-LIGHT-BLUE",
	col(35, 125, 95):   "H10-GREEN",
	col(70, 195, 165):  "H11-LIGHT-GREEN",
	col(100, 75, 80):   "H12-BROWN",
	col(145, 150, 155): "H17-GREY",
	col(170, 85, 80):   "H20-BROWN",
	col(190, 130, 100): "H21-LIGHT-BROWN",
	col(175, 75, 85):   "H22-DARK-RED",
	col(240, 170, 165): "H26-FLESH",
	col(225, 185, 150): "H27-BEIGE",
	col(70, 85, 90):    "H28-DARK-GREEN",
	col(195, 80, 115):  "H29-RASPBERRY",
	col(115, 75, 85):   "H30-BURGUNDY",
	col(105, 160, 175): "H31-TURQUOISE",
	col(255, 95, 200):  "H32-FUCHSIA",
	col(245, 240, 125): "H43-PASTEL-YELLOW",
	col(255, 120, 140): "H44-PASTEL-CORAL",
	col(165, 140, 205): "H45-PASTEL-PURPLE",
	col(80, 170, 225):  "H46-PASTEL-BLUE",
	col(150, 230, 160): "H47-PASTEL-GREEN",
	col(230, 135, 200): "H48-PASTEL-PINK",
	col(240, 175, 95):  "H60-TEDDY-BEAR",

	// Nabbi bead colors
	col(90, 85, 80):    "N02-DARK-BROWN",
	col(105, 75, 80):   "N03-BROWN-MEDIUM",
	col(150, 85, 100):  "N04-WINE-RED",
	col(190, 125, 85):  "N05-BUTTERSCOTCH",
	col(185, 160, 145): "N06-BEIGE",
	col(240, 195, 150): "N07-SKIN",
	col(160, 160, 155): "N08-ASH-GREY",
	col(70, 100, 90):   "N09-DARK-GREEN",
	col(230, 225, 225): "N10-LIGHT-GREY",
	col(115, 90, 155):  "N11-PURPLE",
	col(245, 225, 215): "N12-IVORY",
	col(255, 210, 75):  "N14-YELLOW",
	col(50, 145, 100):  "N16-GREEN",
	col(0, 120, 210):   "N17-BLUE",
	col(245, 200, 190): "N18-LIGHT-PINK",
	col(215, 65, 85):   "N19-LIGHT-RED",
	col(210, 155, 125): "N20-LIGHT-BROWN",
	col(255, 245, 175): "N21-LIGHT-YELLOW",
	col(55, 170, 100):  "N22-PEARL-GREEN",
	col(90, 170, 235):  "N23-PASTEL-BLUE",
	col(200, 185, 240): "N24-LILAC",
	col(255, 120, 165): "N25-OLD-ROSE",
	col(255, 185, 150): "N26-LIGHT-ORANGE",
	col(145, 105, 100): "N27-BROWN",
	col(160, 205, 245): "N28-LIGHT-BLUE",
	col(225, 160, 85):  "N29-PEARL-ORANGE",
	col(200, 200, 120): "N30-OLIVE",
}

type pair struct {
	Key string
	Val uint32
}
type pairlist []pair

func (p pairlist) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }
func (p pairlist) Len() int           { return len(p) }
func (p pairlist) Less(i, j int) bool { return p[i].Val > p[j].Val }
func sortMap(m map[string]uint32) pairlist {
	p := make(pairlist, len(m))
	i := 0
	for k, v := range m {
		p[i] = pair{k, v}
		i++
	}
	sort.Sort(p)
	return p
}
