SRC_DIR     = onsip 
PEM_FILE    = onsip.pem
CRX_FILE    = onsip.crx

default: 
	make onsip.crx

onsip.crx: 
	sh crxmake.sh $(SRC_DIR) $(PEM_FILE)

clean:
	rm -f $(CRX_FILE)
