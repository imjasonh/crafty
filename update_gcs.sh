dest=gs://www.imjasonh.com/palette
gsutil -h "Content-Type: text/html" cp palette $dest/
gsutil -m cp images/*.png $dest/images/
gsutil -m cp *.js $dest/
