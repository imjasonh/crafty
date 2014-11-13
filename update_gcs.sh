dest=gs://www.imjasonh.com/palette/
gsutil -h "Content-Type: text/html" cp palette $dest
gsutil -m cp *.png $dest
gsutil -m cp *.js $dest
