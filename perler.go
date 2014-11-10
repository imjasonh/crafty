package paletteize

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"sort"
	"strconv"
	"text/template"

	"appengine"
)

const (
	rgb8to16 = 0x101   // Multiply an 8-bit RGB value to 16-bit
	bufSize  = 2 << 17 // 256K
)

var tmpl = template.Must(template.New("tmpl").Parse(`
<html><body>
  <a href="/">&laquo; Back</a><br />

  <img src="{{.DataURI}}" /><br />

  <p>Physical dimensions: {{.PhysDim}}</p>

  <p>{{.Total}} pixels</p>
  <table>
    {{range .Counts}}
    <tr><td>{{.Key}}</td><td>{{.Val}}</td>
    {{end}}
  </table>
</body></html>
`))

func init() {
	http.HandleFunc("/upload", handler)
}

func handler(w http.ResponseWriter, r *http.Request) {
	c := appengine.NewContext(r)
	if r.Method != "POST" {
		http.Error(w, r.Method+" not supported", http.StatusMethodNotAllowed)
		return
	}

	mpf, _, err := r.FormFile("file")
	if err != nil {
		c.Errorf("formfile: %v", err)
		http.Error(w, "No file specified", http.StatusBadRequest)
		return
	}
	defer mpf.Close()

	img, err := png.Decode(mpf)
	if err != nil {
		c.Errorf("png decode: %v", err)
		http.Error(w, "Error decoding PNG", http.StatusBadRequest)
		return
	}

	// Select palette map to use
	pal, ok := palettes[r.FormValue("palette")]
	if !ok {

		c.Errorf("unknown palette %q", r.FormValue("palette"))
		http.Error(w, "Unknown palette", http.StatusBadRequest)
		return
	}

	// Make a palette out of all the possible colors
	var palette color.Palette
	for k, _ := range pal.colors {
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
		return strconv.FormatFloat(float64(x)*pal.size, 'g', 3, 64)
	}
	physX := str(img.Bounds().Max.X)
	physY := str(img.Bounds().Max.Y)

	// Total and per-color counts
	var total uint32
	colors := make(map[string]uint32)
	for i := paletted.Bounds().Min.X; i < paletted.Bounds().Max.X; i++ {
		for j := paletted.Bounds().Min.Y; j < paletted.Bounds().Max.Y; j++ {
			c := paletted.At(i, j)
			_, _, _, a := c.RGBA()
			if a == 0 {
				continue
			}
			colors[pal.colors[c]]++
			total++
		}
	}
	tmpl.Execute(w, struct {
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
