SRC_DIR     = source 
PEM_FILE    = source.pem
CRX_FILE    = source.crx

default: 
	make onsip.crx

onsip.crx: 
	sh crxmake.sh $(SRC_DIR) $(PEM_FILE)

clean:
	rm -f $(CRX_FILE)
