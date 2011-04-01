SRC_DIR     = onsip
PEM_FILE    = onsip.pem
CRX_FILE    = onsip.crx
ZIP_FILE    = onsip.zip
default:
	make onsip.crx

onsip.crx:
	sh crxmake.sh $(SRC_DIR) $(PEM_FILE)
	zip -rq ${ZIP_FILE} ${SRC_DIR}
clean:
	rm -f $(CRX_FILE)
	rm -f ${ZIP_FILE}