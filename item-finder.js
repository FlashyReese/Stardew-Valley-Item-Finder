"use strict"
/*
 * Stardew Valley Item Finder
 * https://gucci-on-fleek.github.io/Stardew-Valley-Item-Finder/
 * SPDX-License-Identifier: MPL-2.0+
 * SPDX-FileCopyrightText: 2020 gucci-on-fleek
 */

/* global Tablesort */
/* exported file_opened, download_as_csv, filter_table */

/**
 * Object that produces the HTML template
 * @type {Map<String, Function>}
 * @param {Any} [x] - Template-dependant parameter. Not always required.
 * @returns {DocumentFragment} An element containing the template
 * @effects None
 */
let template

/**
 * Populates the template object with its members
 * @effects Modifies global `template`
 */
function create_template() {
    const __template = {
        table: id("table_base"),
        cell: id("cell_base"),
        row: id("row_base"),
        header_cell: id("header_cell_base"),
        header: id("header_base"),
        silver: id("silver_base"),
        gold: id("gold_base"),
        iridium: id("iridium_base"),
        wiki_query: id("wiki_query_base"),
        wiki_link: id("wiki_link"),
        wiki_search: id("wiki_search"),
    }

    template = {
        table: () => clone_element(__template.table).firstElementChild, // Creates an empty table
        header_cell(x) { // Creates each header cell
            const clone = clone_element(__template.header_cell)
            clone.firstElementChild.insertAdjacentHTML("beforeend", x)

            return clone
        },
        header(x) { // Creates the header row
            const clone = clone_element(__template.header)
            clone.firstElementChild.appendChild(x)

            return clone
        }, /* Produces the quality images */
        silver: () => clone_element(__template.silver),
        gold: () => clone_element(__template.gold),
        iridium: () => clone_element(__template.iridium),
        wiki_query: () => clone_element(__template.wiki_query),
        wiki_link(x) {
            const clone = clone_element(__template.wiki_link)
            clone.firstElementChild.href += encodeURIComponent(x)

            return clone
        },
        wiki_search(x) {
            const clone = clone_element(__template.wiki_search)
            clone.firstElementChild.href += encodeURIComponent(x)

            return clone
        },
    }
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", create_template)
} else { // DOMContentLoaded has already fired
    create_template()
}


window.addEventListener("load", function () {
    get_previous_save()
    navigator.serviceWorker.register("service-worker.js")
})


/**
 * Handle the user opening a file
 * @param {Event} event - The event
 * @remarks Triggered by the file input
 * @effects Modifies the `#table_container` DOM element
 */
function file_opened(event) {
    display_loading(true, true)
    const input = event.target
    const reader = new FileReader()

    reader.onload = function () {
        const file_contents = reader.result
        const save_game = parse_xml(file_contents)

        get_files(["items.xslt", "items-to-csv.xslt"]).then(
            function (requests) {
                const items = process_xslt(parse_xml(requests[0]), save_game)
                const csv = process_xslt(parse_xml(requests[1]), items)

                csv_to_table(xslt_output_to_text(csv))
            })
            .finally(() => display_loading(false, true))
            .catch(() => show_element(id("error")))
    }
    reader.readAsText(input.files[0])
}


/**
 * Loads a previous save file from LocalStorage and treats as if
 * it were manually loaded.
 * @effects None directly, however called functions modify the DOM.
 * @remarks Attempts to load previous save, does nothing if unsuccessful.
 */
function get_previous_save() {
    const csv = localStorage.getItem("csv")
    if (csv) {
        display_loading(true, false)
        _csv_string = csv
        csv_to_table(csv)
        display_loading(false, false)
    }
}


/**
 * A shorthand for `document.getElementById()`
 * @param {String} element_id - The id of the element to retrieve
 * @returns {Element} The element requested
 * @effects None
 */
function id(element_id) {
    return document.getElementById(element_id)
}


/**
 * A shorthand for `document.querySelector()`
 * @param {String} selector - A selector for an element to retrieve
 * @returns {Element} The element requested
 * @effects None
 */
function qs(selector) {
    return document.querySelector(selector)
}


/**
 * A shorthand for `document.querySelectorAll()`
 * @param {String} selector - A selector for the elements to retrieve
 * @returns {Element} The elements requested
 * @effects None
 */
function qsa(selector) {
    return document.querySelectorAll(selector)
}


/**
 * Clone an element
 * @param {Element} element - The element to clone
 * @returns {Element} A duplicate of the initial element
 * @effects None
 */
function clone_element(element) {
    return element.content.cloneNode(true)
}


/**
 * Makes an `HTML` table from `CSV` and inserts it into the DOM.
 * @param {String} csv - The `CSV` to make a table from
 * @effects None directly, however called functions modify the DOM.
 */
function csv_to_table(csv) {
    let table = template.table()
    const csv_array = csv_to_array(csv)
    table = make_html_table(csv_array, table)
    table = make_header(csv_array, table)
    set_output(table)
    enable_table_sort()
    enable_wiki_click()
}


/**
 * Hides a DOM element
 * @param {HTMLElement} element - The element to hide
 * @effects Modifies the DOM to hide the element
 */
function hide_element(element) {
    element.hidden = true
}


/**
 * Shows a DOM element that has been previously hidden
 * @param {HTMLElement} element - The element to show
 * @effects Modifies the DOM to show the element
 */
function show_element(element) {
    element.hidden = false
}


/**
 * Displays a loading indicator
 * @param {Boolean} currently_loading - Should we show or hide the loading display
 * @param {Boolean} hide_input - Should hide the input box
 * @effects Modifies the DOM to show/hide the loading display
 */
function display_loading(currently_loading, hide_input) {
    const loading = id("loading")
    const input = qs("input[type=file]")

    if (currently_loading) {
        show_element(loading)
        if (hide_input) hide_element(input)
    } else {
        show_element(input)
        hide_element(loading)
    }
}


/**
 * Parse a string as `XML`
 * @param {String} text - The string to parse as `XML`
 * @returns {XMLDocument} A `DOM` object representing the input `XML`
 * @effects None
 */
function parse_xml(text) {
    const xml_parser = new DOMParser()

    return xml_parser.parseFromString(text, "text/xml")
}


/**
 * Download an array of URLs
 * @param {String[]} paths - An array of URLs to fetch
 * @returns {Promise} A promise holding the text for each request
 * @effects Initiates a network request to download the URLs
 */
function get_files(paths) {
    const requests = []
    for (const path of paths) {
        requests.push(fetch(path).then(x => x.text()))
    }
    return Promise.all(requests)
}


/**
 * Transform the `XML`
 * @param {DocumentFragment} xslt - The `XSLT` used for the transformation
 * @param {DocumentFragment} xml - The `XML` to transform
 * @returns {DocumentFragment} The transformed `XML`
 * @effects None
 */
function process_xslt(xslt, xml) {
    const xslt_processor = new XSLTProcessor()

    xslt_processor.importStylesheet(xslt)
    const processed = xslt_processor.transformToFragment(xml, new Document()) // Non-standard, but supported by everything that isn't IE

    return processed
}


let _csv_string // Global, holds the CSV so that it can later be downloaded
/**
 * Convert the `XSLT` transformed output into a string. Also, save
 *          the output in LocalStorage.
 * @param {DocumentFragment} xml - The `XML` to convert to a string
 * @returns {String} A string representing the `XML`'s contents
 * @remarks `XSLT` transform a document into another `XML` document
 *          or plain text, however, the `XSLTProcessor` object always
 *          returns an `XMLDocument` object. Since we are transforming
 *          the `CSV` into plain text, we need to call this function
 *          to get a string.
 * @effects Modifies global variable `csv_string`. Also adds `csv` key
 *          to LocalStorage.
 */
function xslt_output_to_text(xml) {
    _csv_string = xml.firstChild.wholeText
    localStorage.setItem("csv", _csv_string)

    return _csv_string
}


/**
 * Parse the `CSV` file into an array
 * @param {String} csv - The `CSV` file
 * @returns {Array(String)} - An array representing the `CSV`
 * @remarks This is a very basic `CSV` parser. It just splits on
 *          commas and newlines, so any edge cases **will not** be
 *          accounted for. However, there won't be any edge cases
 *          since we control the input `CSV`.
 * @effects None
 */
function csv_to_array(csv) {
    return csv.split("\n").map(x => x.split(",")) // We made the csv file, so there won't be any edge cases
}


/**
 * Adds text to an `HTML` element
 * @param {HTMLTableCellElement } cell - The cell to add the text
 * @param {String} text - The text to add
 * @effects Modifies input param `cell`
 */
function cell_text(cell, text) {
    cell.appendChild(document.createTextNode(text))
}


/**
 * Converts the array into the `HTML` table
 * @param {String[]} array - The array to make into a table
 * @param {HTMLTableElement} table - The document fragment to make the table in
 * @returns {HTMLTableElement} The input array as an `HTML` table
 * @effects None
 */
function make_html_table(array, table) {
    for (const csv_row of array.slice(1, -1)) {
        const table_row = table.insertRow()

        for (const [index, csv_cell] of csv_row.entries()) {
            const table_cell = table_row.insertCell()
            if (index === 1) { // Quality column
                const icons = replace_icon(csv_cell)
                table_cell.appendChild(icons[0])
                table_cell.setAttribute("data-sort", csv_cell)
                continue
            }
            cell_text(table_cell, format_integer(csv_cell))
        }
    }
    return table
}


/**
 * Extracts the header from the array and returns an `HTML` table header
 * @param {String[]} array - The array to make into a header
 * @param {HTMLTableElement} table - The document fragment to make the table in
 * @returns {HTMLTableElement} The input array as an `HTML` table header
 * @effects None
 */
function make_header(array, table) {
    const html = new DocumentFragment()
    const row = array[0]
    for (const cell of row) {
        html.append(template.header_cell(cell))
    }
    table.tHead.appendChild(template.header(html))

    return table
}


/**
 * Replace quality names with their corresponding icon
 * @param {"Silver"|"Gold"|"Iridium"|""} quality_name - The quality name (Silver, Gold, or Iridium)
 * @returns {Array<Node, Number>} An array containing an `HTML` fragment containing a star icon and the order in which to sort the quality.
 * @remarks Uses the Stardew Valley icons for qualities
 * @effects None
 */
function replace_icon(quality_name) {
    switch (quality_name) {
        case "Silver":
            return [template.silver(), 1]
        case "Gold":
            return [template.gold(), 2]
        case "Iridium":
            return [template.iridium(), 3]
        default:
            return [document.createTextNode(""), 0]
    }
}


/**
 * Format an integer so that it is human-readable
 * @param {String|Number} number - The integer to format
 * @remarks Separate the thousands by a thin space
 * @effects None
 */
function format_integer(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}


let _previous_output = false // Global, true on 2nd/3rd/xth save file loads
/**
 * Put the table's `HTML` into the document
 * @param {DocumentFragment} table - The `HTML` fragment to add to the document
 * @effects Modifies DOM element `#table_container`. Modifies global variable `previous_output`.
 */
function set_output(table) {
    hide_element(qs("article"))

    if (_previous_output) { // Remove old table
        id("item_table").remove()
    }
    table = calculate_sum(table) // eslint-disable-line no-param-reassign


    const container = id("table_container")
    container.appendChild(table)

    show_element(qs("article"))
    _previous_output = true
    id("filter").focus()
}


/**
 * Strip the thin space added by `format_integer()`
 * @param {String} number - A string containing a number
 * @returns {Number} The integer found, or 0 otherwise
 * @remarks Just concatenates all numerals found in a string
 * @effects None
 */
function parse_integer(number) {
    const match = number.match(/\d/g)

    return match ? Number(match.join("")) : 0
}


/**
 * Show the table sums in its footer
 * @param {HTMLTableElement} table - The document fragment to sum
 * @effects None
 */
function calculate_sum(table) {
    const foot = table.tFoot
    let tot_price = 0
    let tot_count = 0
    const current_hidden_filter_class = `filter_${_filter_class}`

    while (foot.rows[0]) { // Remove old footers
        foot.rows[0].remove()
    }

    for (const row of table.tBodies[0].rows) {
        if (row.classList.contains(current_hidden_filter_class)) {
            continue
        } // Skip if hidden by filter
        tot_count += parse_integer(row.cells[3].textContent)
        tot_price += parse_integer(row.cells[5].textContent)
    }

    const row = foot.insertRow()
    const blank = () => cell_text(row.insertCell(), "")

    cell_text(row.insertCell(), "Total")
    blank()
    blank()
    cell_text(row.insertCell(), format_integer(tot_count))
    blank()
    cell_text(row.insertCell(), format_integer(tot_price))

    return table
}


/**
 * Allow the table to be sorted by clicking on the headings
 * @effects Initializes Tablesort. Adds event listeners to the table headers.
 */
function enable_table_sort() {
    const item_table = id("item_table")
    const tablesort = new Tablesort(item_table) // Allow the table headings to be used for sorting

    Tablesort.extend("number",
        item => item.match(/\d/), // Sort numerically
        (a, b) => parse_integer(a) - parse_integer(b))

    const header_cells = item_table.tHead.rows[0].cells
    for (const cell of header_cells) {
        cell.addEventListener("keydown", function (event) {
            /* Allow the keyboard to be used for sorting */
            if (event.key === "Enter") {
                tablesort.sortTable(event.srcElement)
            }
        })
    }
}


/**
 * Allow the user to download their save as a CSV
 * @param {String} text
 * @remarks Called by the download button
 * @effects Temporarily modifies DOM. Triggers a download.
 */
function download_as_csv(text) {
    const element = document.createElement("a")
    element.setAttribute("href", `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`)
    element.setAttribute("download", "Stardew Valley Items.csv")
    hide_element(element)

    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
}


let _filter_class = 1 // Monotonically incrementing counter to ensure unique CSS classes
/**
 * Allows the table to be filtered
 * @remarks The naïve version of this function directly applied
 *          'display: none' to each row. However, this triggered
 *          a repaint for each row, since it was removed from display.
 *          The optimized version of this function applies a new
 *          and unique class to each row whenever a filter is
 *          applied. Then—and only then—can we hide that class.
 *          This means that only one repaint is triggered instead
 *          of one for each row. In benchmarks, this is about 250%
 *          faster than the old function.
 * @effects Modifies CSS and the `class` attribute of table rows. Modifies global variable `filter_class`.
 */
function filter_table() {
    const filter = id("filter").value
    const table = id("item_table")
    const rows = table.tBodies[0].rows
    const search = RegExp(filter, "i")
    const last_filter_class = _filter_class - 1 // The class that we're adding
    const last_last_filter_class = last_filter_class - 1 // The class that we're removing
    const filter_class_name = `filter_${_filter_class}`
    const last_last_filter_class_name = `filter_${last_last_filter_class}`

    remove_descriptions()
    for (const row of rows) {
        if (!row.textContent.match(search)) {
            row.classList.add(filter_class_name)
        }
        row.classList.remove(last_last_filter_class_name) // Cleanup old filter classes
    }

    const style = document.styleSheets[0]
    style.insertRule(`.${filter_class_name} {visibility: collapse}`)
    if (last_last_filter_class >= 0) {
        style.deleteRule(1)
    }

    _filter_class++ // Increment the class's name
}


/**
 * Allows the user to click on an item name and view its description from the *Stardew Valley Wiki*
 * @effects Adds event listeners. Modifies the DOM. Calls functions which make network requests.
 */
function enable_wiki_click() {
    const table = id("item_table")
    const body = table.tBodies[0]

    body.addEventListener("click", function (event) {
        const target = event.target
        if (target.cellIndex !== 0) { // Only capture click events on the first row
            return
        }
        const page_title = normalize_names(target.textContent)

        let cell // Allow the cell to be carried through each finally/then/catch stages
        wiki_description_by_title(page_title).finally(function () {
            remove_descriptions()
            const row = body.insertRow(target.parentElement.rowIndex)
            row.className = "item_description"
            cell = row.insertCell()
            cell.colSpan = 6
        })
            .then(function (result) {
                cell.innerHTML = result // Use innerHTML because the result can contain character entities
                cell.appendChild(template.wiki_link(page_title))
            })
            .catch(function (result) {
                cell.innerHTML = result
                cell.appendChild(template.wiki_search(page_title))
            })
    })
    table.addEventListener("beforeSort", remove_descriptions) // The colspan attributes cause problems with sorting
}


let _wiki_callback_success, _wiki_callback_failure // Globals, holds resolve/reject functions so that promises can be used
/**
 * Get the description of an item from the *Stardew Valley Wiki* using its name.
 * @param {String} title - The title of the page to request
 * @returns {Promise<String>} A promise representing the network request.
 * @remarks Because we need to make a JSONP request, we can't use promises
 *          without a wrapper. This function is just a wrapper that allows
 *          us to use promises. Sadly, we need to use 2 global variables
 *          to accomplish this.
 * @effects Modifies the global variables `_wiki_callback_*`. Calls
 *          `make_wiki_request` which ultimately makes a network
 *          request. Also modifies the DOM to remove the JSONP
 *          `script` element.
 */
function wiki_description_by_title(title) {
    make_wiki_request(_wiki_callback, {titles: title, prop: "pageprops"})
    const request = new Promise((accept, reject) => {
        _wiki_callback_success = accept; _wiki_callback_failure = reject
    })

    return request.finally(() => id("wiki_query").remove()) // Cleanup
}


/**
 * Make a request to the *Stardew Valley Wiki*.
 * @param {Function} callback - The function to be called with the resultant data
 * @param {Map<String, String>} parameters - The URL parameters to be used for the request
 * @param {Map<String, String>} [default_parameters] - The default parameters URL parameters to use. Only use if you need to override the default parameters.
 * @remarks The Wiki is using a *really* old version of MediaWiki
 *          (circa 2016), so its CORS support is broken. Although
 *          there appears to be some CORS support with the `origin`
 *          parameter, the server will not return an `Access-
 *          Control-Allow-Origin` header, so it is not possible to
 *          make a request this way. Because of this, we need to
 *          fallback to making a JSONP request. JSONP isn't a very
 *          good method for making requests, but the only alternative
 *          is to proxy the requests with a properly-configured
 *          server.
 * @effects Inserts a `script` element into the DOM which ultimately makes a network request.
 *
 */
function make_wiki_request(callback, parameters, default_parameters = {
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: ""
}) {
    const url_parameters = new URLSearchParams({...parameters, ...default_parameters, callback: callback.name})

    const request_element = template.wiki_query()
    request_element.firstElementChild.src += url_parameters.toString()
    document.head.appendChild(request_element)
}


/**
 * Private. The callback used by the JSONP request.
 * @internal
 * @param {Object} data - The data returned by the `Stardew Valley Wiki`.
 * @effects Calls the `_wiki_callback_*` to resolve a promise.
 */
function _wiki_callback(data) {
    try {
        const result = data.query.pages[0].pageprops.description
        _wiki_callback_success(result)
    } catch {
        _wiki_callback_failure("Item not found.")
    }
}


/**
 * Removes old Wiki description rows.
 * @effects Modifies DOM.
 */
function remove_descriptions() {
    const descriptions = qsa(".item_description")
    for (const description of descriptions) {
        description.remove()
    }
}


const _prefixed_items = ["Honey", "Juice", "Wine", "Jelly", "Aged Roe", "Roe"] // Constant that lists all items that need to be normalized before a Wiki request.
/**
 * Normalize item names for the *Stardew Valley Wiki* request.
 * @param {String} name - The name of the item
 * @returns {String} The item name after normalization.
 * @remarks "Large Goat Milk" is listed as "L. ..." in the save file
 *          but there is no redirect for this in the Wiki. The other
 *          items that need to be normalized are all nouns, except for
 *          "pickled", which is corrected to its noun form.
 * @effects None
 */
function normalize_names(name) {
    if (name.includes("L. Goat Milk")) {
        return "Large Goat Milk"
    }
    if (name.includes("Pickled")) {
        return "Pickles"
    }
    for (const item of _prefixed_items) {
        if (name.includes(item)) {
            return item
        }
    }
    return name
}
