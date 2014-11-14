dest=gs://www.imjasonh.com/projects
gsutil -h "Content-Type: text/html" cp crafty ${dest}/
gsutil -m cp *.js ${dest}/
gsutil -m cp images/*.png ${dest}/images/
