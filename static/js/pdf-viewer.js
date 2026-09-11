class PdfViewer {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.pageImages = {};
        this.pageDimensions = {};
        this.scale = 1.0;
        this.onPageChange = null;
        this.onImageReady = null;
    }

    async loadPage(pageNum) {
        if (this.pageImages[pageNum]) {
            return this.pageImages[pageNum];
        }

        const response = await fetch(`/api/pdf/page/${pageNum}`);
        const data = await response.json();

        if (data.image) {
            this.pageImages[pageNum] = data.image;
        }

        return data.image;
    }

    async renderPage(pageNum, container) {
        const imageData = await this.loadPage(pageNum);

        if (!imageData) {
            console.error(`Failed to load page ${pageNum}`);
            return;
        }

        container.innerHTML = "";

        const img = new Image();
        img.src = `data:image/png;base64,${imageData}`;
        img.style.display = "block";
        img.id = "pdf-image";

        const pageKey = String(pageNum);
        const dims = this.pageDimensions[pageKey];
        const pdfWidth = dims ? dims.width : 612;
        const pdfHeight = dims ? dims.height : 792;

        img.onload = () => {
            this.scale = img.width / pdfWidth;

            if (this.onImageReady) {
                this.onImageReady({
                    width: img.width,
                    height: img.height,
                    pdfWidth: pdfWidth,
                    pdfHeight: pdfHeight,
                    scale: this.scale,
                    imgElement: img
                });
            }
        };

        container.appendChild(img);

        this.currentPage = pageNum;

        if (this.onPageChange) {
            this.onPageChange(pageNum, this.totalPages);
        }
    }

    nextPage(container) {
        if (this.currentPage < this.totalPages) {
            return this.renderPage(this.currentPage + 1, container);
        }
        return null;
    }

    prevPage(container) {
        if (this.currentPage > 1) {
            return this.renderPage(this.currentPage - 1, container);
        }
        return null;
    }

}

window.PdfViewer = PdfViewer;
