/*
File: /site/app.js
Purpose: DC3 Construction Equipment Search frontend
*/
console.log("APP JS LOADED");
const state = {
    rawData: null,
    equipment: [],
    issues: {},
    phaseColumns: [],
    filteredEquipment: [],
    searchTokens: [],

    filters: {
        equipmentId: "",
        area: "",
        equipmentType: ""
    }
};

const dom = {
    errorBanner: document.getElementById("error-banner"),
    successBanner: document.getElementById("success-banner"),

    generatedAt: document.getElementById("generated-at"),
    totalEquipment: document.getElementById("total-equipment"),

    searchInput: document.getElementById("search-input"),
    searchBtn: document.getElementById("search-btn"),
    clearSearchBtn: document.getElementById("clear-search-btn"),

    equipmentFilter: document.getElementById("equipment-filter"),
    areaFilter: document.getElementById("area-filter"),
    typeFilter: document.getElementById("type-filter"),
    clearFiltersBtn: document.getElementById("clear-filters-btn"),

    checklistHead: document.getElementById("checklist-head"),
    checklistBody: document.getElementById("checklist-body"),

    checklistCount: document.getElementById("checklist-count"),
    issuesCount: document.getElementById("issues-count"),

    resultsSummary: document.getElementById("results-summary"),
    issuesSummary: document.getElementById("issues-summary"),
    notFoundSummary: document.getElementById("not-found-summary"),

    issuesContainer: document.getElementById("issues-container"),

    notFoundSection: document.getElementById("not-found-section"),
    notFound: document.getElementById("not-found"),

    emptyState: document.getElementById("empty-state"),

    copyBtn: document.getElementById("copy-btn"),
    downloadBtn: document.getElementById("download-btn"),

    reloadBtn: document.getElementById("reload-btn"),

    uploadJsonBtn: document.getElementById("upload-json-btn"),
    jsonUpload: document.getElementById("json-upload")
};

document.addEventListener("DOMContentLoaded", async () => {

    bindEvents();

    await loadDefaultData();
});

async function loadDefaultData() {

    try {

        const response =
            await fetch("/.netlify/functions/get-data");

        if (!response.ok) {
            throw new Error(
                "Failed to load equipment data from server"
            );
        }

        const data =
            await response.json();

        loadDataIntoState(data);

    } catch (error) {

        console.error(error);

        showError(
            "Could not load equipment data. Check your connection or upload a JSON file."
        );
    }
}

function loadDataIntoState(data) {

    validateData(data);

    hideError();
    hideSuccess();

    state.rawData = data;

    state.equipment =
        Array.isArray(data.equipment)
            ? data.equipment
            : [];

    state.issues =
        data.issues || {};
console.log("FULL DATA:", data);
console.log("ISSUES:", state.issues);
console.log("ISSUE KEYS:", Object.keys(state.issues));

    state.phaseColumns =
        data.metadata?.phase_columns || [];

    state.filteredEquipment =
        [...state.equipment];

    state.searchTokens = [];

    state.filters = {
        equipmentId: "",
        area: "",
        equipmentType: ""
    };

    resetFilterInputs();

    renderMetadata(data.metadata || {});

    populateFilters();

    applyFiltersAndRender();
}

function validateData(data) {

    if (!data || typeof data !== "object") {
        throw new Error("Invalid JSON");
    }

    if (!Array.isArray(data.equipment)) {
        throw new Error(
            "Missing equipment array"
        );
    }
}

function bindEvents() {

    dom.searchBtn.addEventListener(
        "click",
        executeSearch
    );

    dom.clearSearchBtn.addEventListener(
        "click",
        clearSearch
    );

    dom.searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.ctrlKey &&
                event.key === "Enter"
            ) {
                executeSearch();
            }
        }
    );

    dom.equipmentFilter.addEventListener(
        "input",
        event => {

            state.filters.equipmentId =
                event.target.value;

            applyFiltersAndRender();
        }
    );

    dom.areaFilter.addEventListener(
        "change",
        event => {

            state.filters.area =
                event.target.value;

            applyFiltersAndRender();
        }
    );

    dom.typeFilter.addEventListener(
        "change",
        event => {

            state.filters.equipmentType =
                event.target.value;

            applyFiltersAndRender();
        }
    );

    dom.clearFiltersBtn.addEventListener(
        "click",
        clearFilters
    );

    dom.copyBtn.addEventListener(
        "click",
        copyVisibleTable
    );

    dom.downloadBtn.addEventListener(
        "click",
        downloadCsv
    );

    dom.reloadBtn.addEventListener(
        "click",
        loadDefaultData
    );

    dom.uploadJsonBtn.addEventListener(
        "click",
        () => {
            dom.jsonUpload.click();
        }
    );

    dom.jsonUpload.addEventListener(
        "change",
        handleJsonUpload
    );
}

async function handleJsonUpload(event) {

    const file = event.target.files[0];

    if (!file) {
        return;
    }

    dom.uploadJsonBtn.disabled = true;

    try {

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
            "/.netlify/functions/upload-data",
            {
                method: "POST",
                body: formData
            }
        );

        let result = {};
        try {
            result = await response.json();
        } catch {
            // ignore parse error on non-JSON responses
        }

        if (response.ok) {

            showSuccess(
                "Data updated for all users."
            );

            const dataResponse =
                await fetch("/.netlify/functions/get-data");

            if (dataResponse.ok) {
                const data = await dataResponse.json();
                loadDataIntoState(data);
            }

        } else {

            showError(
                result.error || "Upload failed."
            );
        }

    } catch (err) {

        console.error(err);

        showError(
            "Network error during upload."
        );

    } finally {

        dom.uploadJsonBtn.disabled = false;
        event.target.value = "";
    }
}

function parseSearchInput(value) {

    if (!value.trim()) {
        return [];
    }

    return [
        ...new Set(
            value
                .split(/[\s,\t\r\n,]+/)
                .map(v =>
                    v.trim().toUpperCase()
                )
                .filter(Boolean)
        )
    ];
}

function executeSearch() {

    state.searchTokens =
        parseSearchInput(
            dom.searchInput.value
        );

    applyFiltersAndRender();
}

function clearSearch() {

    dom.searchInput.value = "";

    state.searchTokens = [];

    applyFiltersAndRender();
}

function clearFilters() {

    state.filters = {
        equipmentId: "",
        area: "",
        equipmentType: ""
    };

    resetFilterInputs();

    applyFiltersAndRender();
}

function resetFilterInputs() {

    dom.equipmentFilter.value = "";
    dom.areaFilter.value = "";
    dom.typeFilter.value = "";
}

function applyFiltersAndRender() {

    let rows = [...state.equipment];

    const notFoundIds = [];

    if (state.searchTokens.length > 0) {

        const map = new Map(
            rows.map(row => [
                String(
                    row["Equipment ID"] || ""
                ).toUpperCase(),
                row
            ])
        );

        const matched = [];

        for (const token of state.searchTokens) {

            if (map.has(token)) {
                matched.push(map.get(token));
            }

            else {
                notFoundIds.push(token);
            }
        }

        rows = matched;
    }

    if (state.filters.equipmentId) {

        const filter =
            state.filters.equipmentId
                .toUpperCase();

        rows = rows.filter(row =>
            String(
                row["Equipment ID"] || ""
            )
                .toUpperCase()
                .includes(filter)
        );
    }

    if (state.filters.area) {

        rows = rows.filter(row =>
            row["Area"] ===
            state.filters.area
        );
    }

    if (state.filters.equipmentType) {

        rows = rows.filter(row =>
            row["Equipment Type"] ===
            state.filters.equipmentType
        );
    }

    state.filteredEquipment = rows;

    renderChecklistTable();

    renderIssuesView();

    renderSummary(notFoundIds);

    renderNotFound(notFoundIds);

    renderEmptyState();
}

function renderMetadata(metadata) {

    dom.totalEquipment.textContent =
        metadata.total_equipment || 0;

    if (!metadata.generated_at) {

        dom.generatedAt.textContent =
            "Unknown";

        return;
    }

    dom.generatedAt.textContent =
        new Date(
            metadata.generated_at
        ).toLocaleString();
}

function populateFilters() {

    populateSelect(
        dom.areaFilter,
        uniqueValues("Area"),
        "All Areas"
    );

    populateSelect(
        dom.typeFilter,
        uniqueValues("Equipment Type"),
        "All Types"
    );
}

function uniqueValues(key) {

    return [
        ...new Set(
            state.equipment
                .map(row => row[key])
                .filter(Boolean)
        )
    ].sort();
}

function populateSelect(
    select,
    values,
    label
) {

    select.innerHTML = "";

    const option =
        document.createElement("option");

    option.value = "";
    option.textContent = label;

    select.appendChild(option);

    for (const value of values) {

        const opt =
            document.createElement("option");

        opt.value = value;
        opt.textContent = value;

        select.appendChild(opt);
    }
}

/**
 * Canonical equipment ID key for issues lookup.
 * Must mirror normalize_equipment_id() in stage5_CATEGORY_OUTPUT_v2.py.
 */
function normalizeEquipmentId(value) {
    return String(value || "").trim().toUpperCase();
}

function renderChecklistTable() {

    renderChecklistHead();

    renderChecklistBody();
}

function renderChecklistHead() {

    const columns = [
        "Equipment ID",
        "Area",
        "Equipment Type",
        ...state.phaseColumns,
        "Critical Issues #",
        "Non-Critical Issues #"
    ];

    dom.checklistHead.innerHTML = `
        <tr>
            ${columns.map(
                c => `<th>${c}</th>`
            ).join("")}
        </tr>
    `;
}

function renderChecklistBody() {

    dom.checklistBody.innerHTML = "";

    for (const row of state.filteredEquipment) {

        const tr =
            document.createElement("tr");

        tr.innerHTML = [

            renderCell(
                row["Equipment ID"]
            ),

            renderCell(
                row["Area"]
            ),

            renderCell(
                row["Equipment Type"]
            ),

            ...state.phaseColumns.map(
                phase =>
                    renderPhaseCell(
                        row[phase]
                    )
            ),

            renderIssueCountCell(
                row["Critical Issues #"],
                true
            ),

            renderIssueCountCell(
                row["Non-Critical Issues #"],
                false
            )

        ].join("");

        dom.checklistBody.appendChild(tr);
    }

    dom.checklistCount.textContent =
        String(
            state.filteredEquipment.length
        );
}

function renderCell(value) {

    return `
        <td>
            ${escapeHtml(value || "—")}
        </td>
    `;
}

function renderPhaseCell(value) {

    if (value === 1) {

        return `
            <td class="status-complete">
                1
            </td>
        `;
    }

    if (value === 0) {

        return `
            <td class="status-incomplete">
                0
            </td>
        `;
    }

    return `
        <td class="status-na">
            -
        </td>
    `;
}

function renderIssueCountCell(
    value,
    critical
) {

    const numericValue =
        Number(value || 0);

    const classes = [];

    if (
        critical &&
        numericValue > 0
    ) {
        classes.push("issue-critical");
    }

    return `
        <td class="${classes.join(" ")}">
            ${numericValue}
        </td>
    `;
}

function renderIssuesView() {

    dom.issuesContainer.innerHTML = "";

    const rows =
        state.filteredEquipment.filter(row =>
            Number(
                row["Critical Issues #"] || 0
            ) > 0 ||

            Number(
                row["Non-Critical Issues #"] || 0
            ) > 0
        );

    dom.issuesCount.textContent =
        `${rows.length} equipment with issues`;

    if (rows.length === 0) {

        dom.issuesContainer.innerHTML = `
            <div class="panel" style="margin:16px;">
                <div style="padding:20px;">
                    No issues found.
                </div>
            </div>
        `;

        return;
    }

    for (const equipment of rows) {

        const equipmentId =
            equipment["Equipment ID"];

        const normalizedId = normalizeEquipmentId(equipmentId);
        if (!state.issues?.[normalizedId]) {
            console.warn(
                "Issue lookup miss:",
                equipmentId,
                Object.keys(state.issues || {}).slice(0, 5)
            );
        }
        const issueData =
            state.issues?.[normalizedId] || {
                critical: [],
                non_critical: []
            };

        const criticalIssues =
            issueData.critical || [];

        const nonCriticalIssues =
            issueData.non_critical || [];

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "issue-equipment-group";

        wrapper.innerHTML = `

            <div class="issue-equipment-header">

                <div>
                    <strong>
                        ${escapeHtml(
                            equipmentId
                        )}
                    </strong>
                </div>

                <div>
                    ${escapeHtml(
                        equipment["Area"] || "—"
                    )}
                </div>

                <div>
                    ${escapeHtml(
                        equipment["Equipment Type"] || "—"
                    )}
                </div>

            </div>

            ${renderIssueSection(
                "Critical",
                "critical",
                criticalIssues
            )}

            ${renderIssueSection(
                "Non-Critical",
                "noncritical",
                nonCriticalIssues
            )}
        `;

        dom.issuesContainer.appendChild(
            wrapper
        );
    }
}

function renderIssueSection(
    title,
    className,
    issues
) {

    if (!issues.length) {

        return `
            <div class="issue-section">

                <div class="
                    issue-section-title
                    issue-section-${className}
                ">
                    ${title}: 0
                </div>

            </div>
        `;
    }

    return `
        <div class="issue-section">

            <div class="
                issue-section-title
                issue-section-${className}
            ">
                ${title}: ${issues.length}
            </div>

            ${issues.map(
                issue =>
                    renderIssueRow(issue)
            ).join("")}

        </div>
    `;
}

function renderIssueRow(issue) {

    return `
        <div class="issue-row">

            <div>
                ${escapeHtml(
                    issue.name || "—"
                )}
            </div>

            <div>
                ${escapeHtml(
                    issue.description || "—"
                )}
            </div>

            <div>
                ${escapeHtml(
                    issue.assigned_to || "—"
                )}
            </div>

            <div>
                ${renderStatusBadge(
                    issue.status || ""
                )}
            </div>

            <div>
                ${renderIssueLink(
                    issue.link || ""
                )}
            </div>

        </div>
    `;
}

function renderIssueLink(link) {

    if (!link) {
        return "—";
    }

    return `
        <a
            href="${link}"
            target="_blank"
            rel="noopener noreferrer"
        >
            Link
        </a>
    `;
}

function renderStatusBadge(status) {

    const normalized =
        String(status)
            .toLowerCase()
            .trim();

    let className =
        "status-default";

    if (
        normalized.includes("open")
    ) {
        className =
            "status-open";
    }

    else if (
        normalized.includes("progress")
    ) {
        className =
            "status-progress";
    }

    else if (
        normalized.includes("ready")
    ) {
        className =
            "status-ready";
    }

    else if (
        normalized.includes("complete")
    ) {
        className =
            "status-complete-badge";
    }

    else if (
        normalized.includes(
            "recommendation"
        )
    ) {
        className =
            "status-recommendation";
    }

    return `
        <span class="
            status-badge
            ${className}
        ">
            ${escapeHtml(
                status || "Unknown"
            )}
        </span>
    `;
}

function renderSummary(notFoundIds) {

    dom.resultsSummary.textContent =
        `Found ${state.filteredEquipment.length} matches`;

    const issuesCount =
        state.filteredEquipment.filter(row =>
            Number(
                row["Critical Issues #"] || 0
            ) > 0 ||

            Number(
                row["Non-Critical Issues #"] || 0
            ) > 0
        ).length;

    dom.issuesSummary.textContent =
        `${issuesCount} equipment`;

    dom.notFoundSummary.textContent =
        String(notFoundIds.length);
}

function renderNotFound(notFoundIds) {

    if (notFoundIds.length === 0) {

        dom.notFoundSection.classList.add(
            "hidden"
        );

        dom.notFound.innerHTML = "";

        return;
    }

    dom.notFoundSection.classList.remove(
        "hidden"
    );

    dom.notFound.innerHTML =
        notFoundIds.map(id => `
            <div class="not-found-item">
                ${escapeHtml(id)}
            </div>
        `).join("");
}

function renderEmptyState() {

    if (
        state.filteredEquipment.length === 0
    ) {

        dom.emptyState.classList.remove(
            "hidden"
        );
    }

    else {

        dom.emptyState.classList.add(
            "hidden"
        );
    }
}

function copyVisibleTable() {

    const rows =
        buildExportRows();

    const text =
        rows
            .map(row =>
                row.join("\t")
            )
            .join("\n");

    navigator.clipboard.writeText(text);
}

function downloadCsv() {

    const rows =
        buildExportRows();

    const csv =
        rows
            .map(row =>
                row
                    .map(csvEscape)
                    .join(",")
            )
            .join("\n");

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        `equipment_export_${Date.now()}.csv`;

    link.click();

    URL.revokeObjectURL(url);
}

function buildExportRows() {

    const rows = [[
        "Equipment ID",
        "Area",
        "Equipment Type",
        ...state.phaseColumns,
        "Critical Issues #",
        "Non-Critical Issues #"
    ]];

    for (const row of state.filteredEquipment) {

        rows.push([

            row["Equipment ID"],

            row["Area"],

            row["Equipment Type"],

            ...state.phaseColumns.map(
                phase => row[phase]
            ),

            row["Critical Issues #"],

            row["Non-Critical Issues #"]
        ]);
    }

    return rows;
}

function csvEscape(value) {

    const stringValue =
        String(value ?? "");

    return `"${stringValue.replace(/"/g, '""')}"`;
}

function showError(message) {

    dom.errorBanner.textContent =
        message;

    dom.errorBanner.classList.remove(
        "hidden"
    );
}

function hideError() {

    dom.errorBanner.classList.add(
        "hidden"
    );
}

function showSuccess(message) {

    dom.successBanner.textContent =
        message;

    dom.successBanner.classList.remove(
        "hidden"
    );

    // Auto-hide after 5 seconds
    setTimeout(hideSuccess, 5000);
}

function hideSuccess() {

    dom.successBanner.classList.add(
        "hidden"
    );
}

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}