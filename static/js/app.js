class App {
    constructor() {
        this.pdfViewer = new PdfViewer();
        this.annotations = [];
        this.selectedFieldId = null;
        this.resolvedValues = {};
        this.validationResult = null;
        this.taxpayerData = null;
        this.pdfLoaded = false;
        this.coordTracker = null;

        this.elements = {};
        this.init();
    }

    init() {
        this.cacheElements();
        this.createCoordTracker();
        this.setupCallbacks();
        this.load();
    }

    cacheElements() {
        this.elements = {
            fieldsList: document.getElementById("fields-list"),
            pdfContainer: document.getElementById("pdf-canvas-container"),
            canvasWrapper: document.getElementById("pdf-canvas-wrapper"),
            annotationOverlay: document.getElementById("annotation-overlay"),
            configPanel: document.getElementById("config-panel"),
            pagePrev: document.getElementById("page-prev"),
            pageNext: document.getElementById("page-next"),
            pageInfo: document.getElementById("page-info"),
            validationBar: document.getElementById("validation-bar"),
            validationStatus: document.getElementById("validation-status"),
            formName: document.getElementById("form-name"),
            formVersion: document.getElementById("form-version"),
            pdfPlaceholder: document.getElementById("pdf-placeholder")
        };
    }

    createCoordTracker() {
        this.coordTracker = document.createElement("div");
        this.coordTracker.className = "coord-tracker";
        this.coordTracker.style.display = "none";
        document.body.appendChild(this.coordTracker);
    }

    setupCallbacks() {
        this.pdfViewer.onPageChange = (page, total) => {
            this.elements.pageInfo.textContent = `Page ${page} of ${total}`;
            this.elements.pagePrev.disabled = page <= 1;
            this.elements.pageNext.disabled = page >= total;
        };

        this.pdfViewer.onImageReady = (info) => {
            this.setupImageHover(info.imgElement);
            this.renderAnnotations();
        };

        this.elements.pagePrev.addEventListener("click", () => this.navigatePage(-1));
        this.elements.pageNext.addEventListener("click", () => this.navigatePage(1));

        document.getElementById("btn-add-field").addEventListener("click", () => this.addField());
        document.getElementById("btn-export").addEventListener("click", () => this.exportAnnotation());
        document.getElementById("btn-generate").addEventListener("click", () => this.generatePdf());
        document.getElementById("btn-validate").addEventListener("click", () => this.showValidation());
        document.getElementById("btn-upload").addEventListener("click", () => this.showUploadModal());

        this.setupConfigPanelListeners();
    }

    setupImageHover(img) {
        let lastClientX = 0;
        let lastClientY = 0;

        img.addEventListener("mousemove", (e) => {
            lastClientX = e.clientX;
            lastClientY = e.clientY;
            this.updateCoords(img, e.clientX, e.clientY);
        });

        img.addEventListener("mouseleave", () => {
            this.coordTracker.style.display = "none";
        });

        const wrapper = this.elements.canvasWrapper;
        wrapper.addEventListener("scroll", () => {
            this.updateCoords(img, lastClientX, lastClientY);
        });
    }

    updateCoords(img, clientX, clientY) {
        const rect = img.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const pdfX = Math.round(screenX / this.pdfViewer.scale);
        const pdfY = Math.round(screenY / this.pdfViewer.scale);

        this.coordTracker.textContent = `x: ${pdfX}  y: ${pdfY}`;
        this.coordTracker.style.display = "block";
        this.coordTracker.style.left = (clientX + 16) + "px";
        this.coordTracker.style.top = (clientY - 10) + "px";
    }

    setupConfigPanelListeners() {
        const fields = ["field-id", "field-label", "field-type", "field-value-path",
            "field-page", "field-x", "field-y", "field-width", "field-height",
            "field-font-size", "field-alignment", "field-currency",
            "field-decimal-places", "field-date-format"];

        for (const fieldId of fields) {
            const el = document.getElementById(fieldId);
            if (el) {
                el.addEventListener("change", () => this.handleConfigChange());
                el.addEventListener("input", () => this.handleConfigChange());
            }
        }
    }

    async load() {
        try {
            const [annResp, taxpayerResp, pdfMetaResp] = await Promise.all([
                fetch("/api/annotations"),
                fetch("/api/taxpayer"),
                fetch("/api/pdf/metadata")
            ]);

            const annData = await annResp.json();
            this.taxpayerData = await taxpayerResp.json();
            this.annotations = annData.fields || [];
            const pdfMeta = await pdfMetaResp.json();

            if (annData.form) {
                this.elements.formName.textContent = annData.form.name || "";
                this.elements.formVersion.textContent = annData.form.version || "";
            }

            if (pdfMeta.loaded) {
                this.pdfLoaded = true;
                this.pdfViewer.totalPages = pdfMeta.page_count;
                this.pdfViewer.pageDimensions = pdfMeta.pages;
                await this.pdfViewer.renderPage(1, this.elements.pdfContainer);
                this.hidePdfPlaceholder();
            } else {
                this.showPdfPlaceholder();
            }

            await this.resolveAllValues();
            this.renderFieldsList();
            await this.validate();
        } catch (err) {
            console.error("Failed to load:", err);
        }
    }

    showPdfPlaceholder() {
        if (this.elements.pdfPlaceholder) {
            this.elements.pdfPlaceholder.style.display = "flex";
        }
        if (this.elements.annotationOverlay) {
            this.elements.annotationOverlay.style.display = "none";
        }
    }

    hidePdfPlaceholder() {
        if (this.elements.pdfPlaceholder) {
            this.elements.pdfPlaceholder.style.display = "none";
        }
        if (this.elements.annotationOverlay) {
            this.elements.annotationOverlay.style.display = "block";
        }
    }

    showUploadModal() {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal" style="min-width: 480px;">
                <h3>Upload Tax Form PDF</h3>
                <div class="config-section" style="border:none; padding:0;">
                    <div class="config-field">
                        <label>Select PDF file</label>
                        <input type="file" id="upload-pdf-file" accept=".pdf" style="padding:8px; border:1px solid #0f3460; border-radius:3px; background:#1a1a2e; color:#e0e0e0; width:100%;">
                    </div>
                </div>
                <div id="upload-progress" style="display:none; margin:12px 0; color:#888; font-size:12px;">Uploading...</div>
                <div id="upload-error" style="display:none; margin:12px 0; color:#ff6b6b; font-size:12px;"></div>
                <div class="modal-actions">
                    <button class="toolbar-btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="toolbar-btn primary" id="btn-do-upload">Upload</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.getElementById("btn-do-upload").addEventListener("click", () => {
            this.handleUpload(overlay);
        });
    }

    async handleUpload(overlay) {
        const fileInput = document.getElementById("upload-pdf-file");
        const progressEl = document.getElementById("upload-progress");
        const errorEl = document.getElementById("upload-error");

        if (!fileInput.files.length) {
            errorEl.textContent = "Please select a PDF file.";
            errorEl.style.display = "block";
            return;
        }

        const file = fileInput.files[0];
        progressEl.style.display = "block";
        errorEl.style.display = "none";

        const formData = new FormData();
        formData.append("pdf", file);

        try {
            const resp = await fetch("/api/pdf/upload", {
                method: "POST",
                body: formData
            });

            const data = await resp.json();

            if (!resp.ok) {
                errorEl.textContent = data.error || "Upload failed.";
                errorEl.style.display = "block";
                progressEl.style.display = "none";
                return;
            }

            overlay.remove();
            this.pdfLoaded = true;
            this.pdfViewer.totalPages = data.pdf_metadata.page_count;
            this.pdfViewer.pageDimensions = data.pdf_metadata.pages;

            this.showMetadataModal(file.name, data.pdf_metadata);
        } catch (err) {
            errorEl.textContent = "Upload failed: " + err.message;
            errorEl.style.display = "block";
            progressEl.style.display = "none";
        }
    }

    showMetadataModal(filename, pdfMetadata) {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal" style="min-width: 480px;">
                <h3>Form Metadata</h3>
                <p style="font-size:12px; color:#888; margin-bottom:12px;">
                    Attached: ${filename} (${pdfMetadata.page_count} page${pdfMetadata.page_count > 1 ? "s" : ""})
                </p>
                <div class="config-section" style="border:none; padding:0;">
                    <div class="config-field">
                        <label>Form ID</label>
                        <input type="text" id="meta-form-id" value="custom" placeholder="e.g., 1040, W-2">
                    </div>
                    <div class="config-field">
                        <label>Form Name</label>
                        <input type="text" id="meta-form-name" value="${filename.replace('.pdf', '')}" placeholder="e.g., U.S. Individual Income Tax Return">
                    </div>
                    <div class="config-field">
                        <label>Version</label>
                        <input type="text" id="meta-form-version" value="2025" placeholder="e.g., 2025">
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="toolbar-btn" onclick="this.closest('.modal-overlay').remove()">Skip</button>
                    <button class="toolbar-btn primary" id="btn-save-metadata">Save & Load</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.getElementById("btn-save-metadata").addEventListener("click", async () => {
            const formId = document.getElementById("meta-form-id").value || "custom";
            const formName = document.getElementById("meta-form-name").value || filename.replace(".pdf", "");
            const formVersion = document.getElementById("meta-form-version").value || "2025";

            await fetch("/api/pdf/metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ formId, formName, formVersion })
            });

            overlay.remove();

            this.elements.formName.textContent = formName;
            this.elements.formVersion.textContent = formVersion;

            this.hidePdfPlaceholder();
            await this.pdfViewer.renderPage(1, this.elements.pdfContainer);
            this.renderAnnotations();
            await this.validate();
        });
    }

    async resolveAllValues() {
        try {
            const resp = await fetch("/api/resolve/all");
            const data = await resp.json();
            this.resolvedValues = {};
            for (const field of data.fields) {
                this.resolvedValues[field.id] = field.formatted;
            }
        } catch (err) {
            console.error("Failed to resolve values:", err);
        }
    }

    renderFieldsList() {
        const list = this.elements.fieldsList;
        list.innerHTML = "";

        if (this.annotations.length === 0) {
            list.innerHTML = '<div class="no-fields-message">No fields yet.<br>Upload a PDF and add fields.</div>';
            return;
        }

        for (const field of this.annotations) {
            const item = document.createElement("div");
            item.className = "field-item";
            if (field.id === this.selectedFieldId) item.classList.add("selected");

            const isVisible = this.isFieldVisible(field);
            if (!isVisible) item.classList.add("hidden");

            const hasError = this.fieldHasError(field.id);
            if (hasError) item.classList.add("has-error");

            const statusClass = hasError ? "error" : (isVisible ? "" : "hidden");

            item.innerHTML = `
                <div class="field-status ${statusClass}"></div>
                <div class="field-info">
                    <div class="field-id">${field.id}</div>
                    <div class="field-label">${field.label}</div>
                </div>
                <button class="field-delete-btn" title="Delete field">&times;</button>
            `;

            item.querySelector(".field-delete-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteField(field.id);
            });

            item.addEventListener("click", () => this.selectField(field.id));
            list.appendChild(item);
        }
    }

    isFieldVisible(field) {
        const vw = field.visibleWhen;
        if (!vw) return true;
        if (!this.taxpayerData) return true;

        const path = vw.path;
        const equals = vw.equals;

        let value = this.taxpayerData;
        for (const key of path.split(".")) {
            if (value && typeof value === "object" && key in value) {
                value = value[key];
            } else {
                return false;
            }
        }

        return String(value) === String(equals);
    }

    fieldHasError(fieldId) {
        if (!this.validationResult) return false;
        return this.validationResult.errors.some(e => e.fieldId === fieldId);
    }

    selectField(fieldId) {
        if (this.selectedFieldId && this.selectedFieldId !== fieldId) {
            this.saveCurrentField();
        }
        this.selectedFieldId = fieldId;
        this.renderFieldsList();
        this.showFieldConfig(fieldId);
        this.highlightAnnotation(fieldId);
    }

    saveCurrentField() {
        if (!this.selectedFieldId) return;
        const field = this.annotations.find(f => f.id === this.selectedFieldId);
        if (!field) return;

        const idEl = document.getElementById("field-id");
        const labelEl = document.getElementById("field-label");
        const typeEl = document.getElementById("field-type");
        const pathEl = document.getElementById("field-value-path");
        const pageEl = document.getElementById("field-page");
        const xEl = document.getElementById("field-x");
        const yEl = document.getElementById("field-y");
        const wEl = document.getElementById("field-width");
        const hEl = document.getElementById("field-height");

        if (idEl) field.id = idEl.value;
        if (labelEl) field.label = labelEl.value;
        if (typeEl) field.type = typeEl.value;
        if (pathEl) field.valuePath = pathEl.value;
        if (pageEl) field.position.page = parseInt(pageEl.value) || 1;
        if (xEl) field.position.x = parseInt(xEl.value) || 0;
        if (yEl) field.position.y = parseInt(yEl.value) || 0;
        if (wEl) field.position.width = parseInt(wEl.value) || 100;
        if (hEl) field.position.height = parseInt(hEl.value) || 20;

        const fmtEl = document.getElementById("field-font-size");
        const alignEl = document.getElementById("field-alignment");
        if (fmtEl) field.format.fontSize = parseInt(fmtEl.value) || 10;
        if (alignEl) field.format.alignment = alignEl.value;

        if (field.type === "currency") {
            const curEl = document.getElementById("field-currency");
            if (curEl) field.format.currency = curEl.value;
        }
        if (field.type === "currency" || field.type === "number") {
            const decEl = document.getElementById("field-decimal-places");
            if (decEl) field.format.decimalPlaces = parseInt(decEl.value) || 0;
        }
        if (field.type === "date") {
            const dateEl = document.getElementById("field-date-format");
            if (dateEl) field.format.dateFormat = dateEl.value;
        }

        this.selectedFieldId = field.id;
    }

    highlightAnnotation(fieldId) {
        const boxes = this.elements.annotationOverlay.querySelectorAll(".annotation-box");
        boxes.forEach(box => {
            box.classList.toggle("selected", box.dataset.fieldId === fieldId);
        });
    }

    showFieldConfig(fieldId) {
        const panel = this.elements.configPanel;
        const field = this.annotations.find(f => f.id === fieldId);

        if (!field) {
            panel.innerHTML = '<div class="empty-config">Select a field to configure</div>';
            return;
        }

        const fmt = field.format || {};
        const val = field.validation || {};
        const vw = field.visibleWhen;

        panel.innerHTML = `
            <div class="config-section">
                <div class="config-section-title">Basic Properties</div>
                <div class="config-field">
                    <label>Field ID</label>
                    <input type="text" id="field-id" value="${field.id || ""}">
                </div>
                <div class="config-field">
                    <label>Label</label>
                    <input type="text" id="field-label" value="${field.label || ""}">
                </div>
                <div class="config-field">
                    <label>Type</label>
                    <select id="field-type">
                        <option value="text" ${field.type === "text" ? "selected" : ""}>Text</option>
                        <option value="number" ${field.type === "number" ? "selected" : ""}>Number</option>
                        <option value="currency" ${field.type === "currency" ? "selected" : ""}>Currency</option>
                        <option value="date" ${field.type === "date" ? "selected" : ""}>Date</option>
                        <option value="checkbox" ${field.type === "checkbox" ? "selected" : ""}>Checkbox</option>
                    </select>
                </div>
                <div class="config-field">
                    <label>Value Path</label>
                    <input type="text" id="field-value-path" value="${field.valuePath || ""}">
                </div>
            </div>

            <div class="config-section">
                <div class="config-section-title">Position</div>
                <p style="font-size:11px; color:#666; margin-bottom:8px;">Hover over the PDF to see coordinates, then enter them here.</p>
                <div class="config-field">
                    <label>Page</label>
                    <input type="number" id="field-page" value="${field.position.page}" min="1">
                </div>
                <div class="position-inputs">
                    <div class="config-field">
                        <label>X</label>
                        <input type="number" id="field-x" value="${Math.round(field.position.x)}" min="0">
                    </div>
                    <div class="config-field">
                        <label>Y</label>
                        <input type="number" id="field-y" value="${Math.round(field.position.y)}" min="0">
                    </div>
                    <div class="config-field">
                        <label>Width</label>
                        <input type="number" id="field-width" value="${Math.round(field.position.width)}" min="1">
                    </div>
                    <div class="config-field">
                        <label>Height</label>
                        <input type="number" id="field-height" value="${Math.round(field.position.height)}" min="1">
                    </div>
                </div>
            </div>

            <div class="config-section">
                <div class="config-section-title">Formatting</div>
                <div class="config-field">
                    <label>Font Size</label>
                    <input type="number" id="field-font-size" value="${fmt.fontSize || 10}" min="6" max="24">
                </div>
                <div class="config-field">
                    <label>Alignment</label>
                    <select id="field-alignment">
                        <option value="left" ${(fmt.alignment || "left") === "left" ? "selected" : ""}>Left</option>
                        <option value="center" ${fmt.alignment === "center" ? "selected" : ""}>Center</option>
                        <option value="right" ${fmt.alignment === "right" ? "selected" : ""}>Right</option>
                    </select>
                </div>
                <div class="config-field" id="currency-field" style="display:${field.type === "currency" ? "block" : "none"}">
                    <label>Currency</label>
                    <select id="field-currency">
                        <option value="USD" ${(fmt.currency || "USD") === "USD" ? "selected" : ""}>USD ($)</option>
                        <option value="EUR" ${fmt.currency === "EUR" ? "selected" : ""}>EUR (\u20ac)</option>
                        <option value="GBP" ${fmt.currency === "GBP" ? "selected" : ""}>GBP (\u00a3)</option>
                    </select>
                </div>
                <div class="config-field" id="decimal-field" style="display:${["currency", "number"].includes(field.type) ? "block" : "none"}">
                    <label>Decimal Places</label>
                    <input type="number" id="field-decimal-places" value="${fmt.decimalPlaces || 2}" min="0" max="6">
                </div>
                <div class="config-field" id="date-format-field" style="display:${field.type === "date" ? "block" : "none"}">
                    <label>Date Format</label>
                    <select id="field-date-format">
                        <option value="MM/DD/YYYY" ${(fmt.dateFormat || "MM/DD/YYYY") === "MM/DD/YYYY" ? "selected" : ""}>MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD" ${fmt.dateFormat === "YYYY-MM-DD" ? "selected" : ""}>YYYY-MM-DD</option>
                        <option value="DD/MM/YYYY" ${fmt.dateFormat === "DD/MM/YYYY" ? "selected" : ""}>DD/MM/YYYY</option>
                    </select>
                </div>
            </div>

        `;

        this.setupConfigPanelListeners();
    }

    handleConfigChange() {
        if (!this.selectedFieldId) return;

        const field = this.annotations.find(f => f.id === this.selectedFieldId);
        if (!field) return;

        field.id = document.getElementById("field-id").value;
        this.selectedFieldId = field.id;
        field.label = document.getElementById("field-label").value;
        field.type = document.getElementById("field-type").value;
        field.valuePath = document.getElementById("field-value-path").value;

        field.position.page = parseInt(document.getElementById("field-page").value) || 1;
        field.position.x = parseInt(document.getElementById("field-x").value) || 0;
        field.position.y = parseInt(document.getElementById("field-y").value) || 0;
        field.position.width = parseInt(document.getElementById("field-width").value) || 100;
        field.position.height = parseInt(document.getElementById("field-height").value) || 20;

        field.format = field.format || {};
        field.format.fontSize = parseInt(document.getElementById("field-font-size").value) || 10;
        field.format.alignment = document.getElementById("field-alignment").value;

        if (field.type === "currency") {
            field.format.currency = document.getElementById("field-currency").value;
        }
        if (field.type === "currency" || field.type === "number") {
            field.format.decimalPlaces = parseInt(document.getElementById("field-decimal-places").value) || 0;
        }
        if (field.type === "date") {
            field.format.dateFormat = document.getElementById("field-date-format").value;
        }

        this.renderFieldsList();
        this.renderAnnotations();
    }

    addField() {
        if (!this.pdfLoaded) {
            alert("Please upload a PDF first.");
            return;
        }

        const dims = this.pdfViewer.pageDimensions[String(this.pdfViewer.currentPage)];
        const centerX = dims ? dims.width / 2 : 306;
        const centerY = dims ? dims.height / 2 : 396;

        const newField = {
            id: `field_${Date.now()}`,
            label: "New Field",
            type: "text",
            valuePath: "",
            position: {
                page: this.pdfViewer.currentPage,
                x: Math.round(centerX - 50),
                y: Math.round(centerY - 10),
                width: 100,
                height: 20
            },
            format: {
                fontSize: 10,
                alignment: "left"
            }
        };

        this.annotations.push(newField);
        this.renderFieldsList();
        this.renderAnnotations();
        this.selectField(newField.id);
    }

    deleteField(fieldId) {
        this.annotations = this.annotations.filter(f => f.id !== fieldId);

        if (this.selectedFieldId === fieldId) {
            this.selectedFieldId = null;
            this.elements.configPanel.innerHTML = '<div class="empty-config">Select a field to configure</div>';
        }

        this.renderFieldsList();
        this.renderAnnotations();
    }

    renderAnnotations() {
        if (!this.elements.annotationOverlay) return;

        const overlay = this.elements.annotationOverlay;
        overlay.innerHTML = "";

        if (!this.pdfLoaded) return;

        const scale = this.pdfViewer.scale;

        for (const field of this.annotations) {
            const box = document.createElement("div");
            box.className = "annotation-box";
            box.dataset.fieldId = field.id;

            if (field.id === this.selectedFieldId) {
                box.classList.add("selected");
            }

            const isVisible = this.isFieldVisible(field);
            if (!isVisible) {
                box.classList.add("hidden-field");
            }

            box.style.left = (field.position.x * scale) + "px";
            box.style.top = (field.position.y * scale) + "px";
            box.style.width = (field.position.width * scale) + "px";
            box.style.height = (field.position.height * scale) + "px";

            const label = document.createElement("div");
            label.className = "annotation-label";
            label.textContent = field.label || field.id;
            box.appendChild(label);

            const value = document.createElement("div");
            value.className = "annotation-value";
            value.textContent = this.resolvedValues[field.id] || "";
            box.appendChild(value);

            box.addEventListener("click", (e) => {
                e.stopPropagation();
                this.selectField(field.id);
            });

            overlay.appendChild(box);
        }
    }

    async navigatePage(direction) {
        const container = this.elements.pdfContainer;
        if (direction === -1) {
            await this.pdfViewer.prevPage(container);
        } else {
            await this.pdfViewer.nextPage(container);
        }
        this.renderAnnotations();
    }

    async validate() {
        try {
            const resp = await fetch("/api/annotations/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fields: this.annotations })
            });

            this.validationResult = await resp.json();
            this.updateValidationBar();
            this.renderFieldsList();
        } catch (err) {
            console.error("Validation failed:", err);
        }
    }

    updateValidationBar() {
        const bar = this.elements.validationStatus;
        const result = this.validationResult;

        if (!result) {
            bar.className = "validation-status";
            bar.innerHTML = '<div class="validation-dot"></div> Not validated';
            return;
        }

        if (result.valid && result.warning_count === 0) {
            bar.className = "validation-status valid";
            bar.innerHTML = `<div class="validation-dot"></div> ${result.field_count} fields valid`;
        } else if (result.valid && result.warning_count > 0) {
            bar.className = "validation-status warning";
            bar.innerHTML = `<div class="validation-dot"></div> ${result.field_count} fields valid, ${result.warning_count} warnings`;
        } else {
            bar.className = "validation-status invalid";
            bar.innerHTML = `<div class="validation-dot"></div> ${result.error_count} error(s), ${result.warning_count} warning(s)`;
        }
    }

    showValidation() {
        this.validate().then(() => {
            const result = this.validationResult;
            if (!result) return;

            const overlay = document.createElement("div");
            overlay.className = "modal-overlay";

            let errorsHtml = "";
            for (const err of result.errors) {
                errorsHtml += `<div class="error-item">${err.fieldId ? `[${err.fieldId}] ` : ""}${err.message}</div>`;
            }
            for (const warn of result.warnings) {
                errorsHtml += `<div class="error-item warning">${warn.fieldId ? `[${warn.fieldId}] ` : ""}${warn.message}</div>`;
            }

            if (result.valid && result.warning_count === 0) {
                errorsHtml = `<div class="error-item" style="border-left-color:#4caf50">All ${result.field_count} fields are valid.</div>`;
            }

            overlay.innerHTML = `
                <div class="modal">
                    <h3>Annotation Validation</h3>
                    <div class="error-list">${errorsHtml}</div>
                    <div class="modal-actions">
                        <button class="toolbar-btn" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) overlay.remove();
            });
        });
    }

    async exportAnnotation() {
        const form = {
            id: this.elements.formName.textContent || "custom",
            name: this.elements.formName.textContent || "Custom Tax Form",
            version: this.elements.formVersion.textContent || "2025"
        };

        const data = {
            form: form,
            fields: this.annotations
        };

        const jsonStr = JSON.stringify(data, null, 2);

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal" style="min-width: 600px; max-width: 700px;">
                <h3>Export Annotation JSON</h3>
                <textarea id="export-json" readonly style="width:100%; height:350px; background:#1a1a2e; color:#e0e0e0; border:1px solid #0f3460; border-radius:4px; padding:10px; font-family:monospace; font-size:12px; resize:vertical;">${jsonStr}</textarea>
                <div class="modal-actions">
                    <button class="toolbar-btn" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    <button class="toolbar-btn primary" id="btn-copy-json">Copy to Clipboard</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.getElementById("btn-copy-json").addEventListener("click", () => {
            const textarea = document.getElementById("export-json");
            textarea.select();
            navigator.clipboard.writeText(textarea.value).then(() => {
                const btn = document.getElementById("btn-copy-json");
                btn.textContent = "Copied!";
                setTimeout(() => { btn.textContent = "Copy to Clipboard"; }, 1500);
            });
        });
    }

    async generatePdf() {
        if (!this.pdfLoaded) {
            alert("Please upload a PDF first.");
            return;
        }

        try {
            const saveResp = await fetch("/api/annotations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    form: {
                        id: this.elements.formName.textContent || "form",
                        name: this.elements.formName.textContent || "Tax Form",
                        version: this.elements.formVersion.textContent || "2025"
                    },
                    fields: this.annotations
                })
            });

            if (!saveResp.ok) throw new Error("Failed to save annotations");

            window.location.href = "/forms/1040/generate";
        } catch (err) {
            console.error("Generate PDF failed:", err);
            alert("Failed to generate PDF: " + err.message);
        }
    }
}

let app;
document.addEventListener("DOMContentLoaded", () => {
    app = new App();
});
