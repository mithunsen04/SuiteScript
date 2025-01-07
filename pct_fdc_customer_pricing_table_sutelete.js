/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/record', 'N/ui/serverWidget', 'N/file', 'N/search', 'N/log'], function (record, ui, file, search, log) {

    function onRequest(context) {
        log.debug('Start Suitelet', 'Request method: ' + context.request.method);

        if (context.request.method === 'GET') {
            try {
                log.debug('GET Request', 'Handling GET request.');

                // Load the HTML file for the Suitelet
                var htmlFile = file.load({ id: 'SuiteScripts/GetCustomerpricing/View/getCustomerPricingTable.html' });
                var htmlContent = htmlFile.getContents();
                log.debug('HTML File Loaded', 'HTML content loaded successfully.');

                // Add the customer dropdown dynamically
                var customerSearch = search.create({
                    type: "customer",
                    filters: [],
                    columns: [
                        search.createColumn({ name: "altname", label: "Customer Name" }),
                        search.createColumn({ name: "internalid", label: "Customer ID" }),
                        search.createColumn({ name: "entityid", label: "Customer InternalId" }),

                    ]
                });

                log.debug('Customer Search Created', 'Running customer search.');

                var customers = [];
                customerSearch.run().each(function (result) {
                    customers.push({
                        id: result.getValue({ name: "internalid" }),
                        name: result.getValue({ name: "altname" }),
                        internalId: result.getValue({ name: "entityid" }),

                    });
                    return true;
                });

                log.debug('Customer Search Results', 'Found ' + customers.length + ' customers.');

                // // Inject customer dropdown options into HTML
                // var customerOptions = customers.map(function (customer) {
                //     return '<option value="' + customer.id + '">' + customer.name + '</option>';
                // }).join("");

                // Inject customer dropdown options into HTML
                var customerOptions = customers.map(function (customer) {
                    return '<option value="' + customer.id + '">' + customer.name + ' (' + customer.internalId + ')' + '</option>';
                }).join("");


                log.debug('Customer Options Generated', 'Generated customer dropdown options.');

                htmlContent = htmlContent.replace("{{customerOptions}}", customerOptions);
                context.response.write(htmlContent);
                log.debug('GET Response Sent', 'HTML form loaded with customer options.');

            } catch (e) {
                log.error('Error in GET', e.message);
                context.response.write('Error: ' + e.message);
            }
        } else if (context.request.method === 'POST') {
            try {
                log.debug('POST Request', 'Handling POST request.');

                // Get parameters from the request
                var customerId = context.request.parameters.customerId;
                var prodClass = context.request.parameters.prodClass;
                var priceLevel = context.request.parameters.priceLevel;
                var selectedRow = context.request.parameters.selectedRow;
                var start = parseInt(context.request.parameters.start) || 0;
                var end = parseInt(context.request.parameters.end) || 100;

                log.debug('Selected Customer ID', customerId);
                log.debug('Selected Row', selectedRow);
                log.debug('Start and End', 'Start: ' + start + ', End: ' + end);

                // If customerId is provided, run the first search (customer pricing data)
                if (!prodClass && !priceLevel) {
                    var customrecordSearch = search.create({
                        type: "customrecord_fdc_cust_pricing_table",
                        filters: [
                            ["custrecord_fdc_cust_price_customer", "anyof", customerId]
                        ],
                        columns: [
                            search.createColumn({
                                name: "custrecord_fdc_cust_price_prod_class",
                                join: "CUSTRECORD1395",
                                label: "Product Class"
                            }),
                            search.createColumn({
                                name: "custrecord1394",
                                join: "CUSTRECORD1395",
                                label: "Price Group"
                            }),
                            search.createColumn({
                                name: "custrecord1396",
                                join: "CUSTRECORD1395",
                                label: "Price Level"
                            })
                        ]
                    });

                    log.debug('First Search Created', 'Running customer pricing table search.');
                    var searchResultCount = customrecordSearch.runPaged().count;

                    var searchResult = customrecordSearch.run().getRange({
                        start: start,
                        end: end
                    });

                    var pricingTableData = [];
                    for (var i = 0; i < searchResult.length; i++) {
                        pricingTableData.push({
                            prodClass: {
                                text: searchResult[i].getText({ name: "custrecord_fdc_cust_price_prod_class", join: "CUSTRECORD1395" }),
                                value: searchResult[i].getValue({ name: "custrecord_fdc_cust_price_prod_class", join: "CUSTRECORD1395" })
                            },
                            priceGroup: {
                                text: searchResult[i].getText({ name: "custrecord1394", join: "CUSTRECORD1395" }),
                                value: searchResult[i].getValue({ name: "custrecord1394", join: "CUSTRECORD1395" })
                            },
                            priceLevel: {
                                text: searchResult[i].getText({ name: "custrecord1396", join: "CUSTRECORD1395" }),
                                value: searchResult[i].getValue({ name: "custrecord1396", join: "CUSTRECORD1395" })
                            }
                        });
                    }

                    log.debug('First Search Results', 'Fetched ' + pricingTableData.length + ' rows.');

                    // Return the customer pricing table data
                    context.response.write(JSON.stringify({
                        pricingTableData: pricingTableData,
                        searchResultCount: searchResultCount
                    }));
                    return;  // Exit after sending the first response
                }

                // If selectedRow is provided, run the second search (assembly item data)
                if (prodClass || priceLevel) {
                    log.debug('Second Search Triggered', 'Running assembly item search.');

                    var assemblyItemSearch = search.create({
                        type: "assemblyitem",
                        filters: [
                            ["class", "anyof", prodClass],
                            "AND",
                            ["pricinggroup", "anyof", "@NONE@"],
                            "AND",
                            ["pricing.pricelevel", "anyof", priceLevel]
                        ],
                        columns: [
                            search.createColumn({ name: "itemid", label: "Name" }),
                            search.createColumn({ name: "class", label: "Product Class" }),
                            search.createColumn({ name: "pricinggroup", label: "Pricing Group" }),
                            search.createColumn({ name: "baseprice", label: "Base Price" }),
                            search.createColumn({
                                name: "pricelevel",
                                join: "pricing",
                                label: "Price Level"
                            }),
                            search.createColumn({
                                name: "quantityrange",
                                join: "pricing",
                                label: "Quantity Range"
                            })
                        ]
                    });

                    var assemblyItemData = [];
                    assemblyItemSearch.run().each(function (result) {
                        assemblyItemData.push({
                            itemName: result.getValue({ name: "itemid" }),
                            productClass: result.getText({ name: "class" }),
                            pricingGroup: result.getText({ name: "pricinggroup" }),
                            unitPrice: result.getValue({ name: "baseprice" }),
                            priceLevel: result.getText({ name: "pricelevel", join: "pricing" })
                        });
                        return true;
                    });

                    log.debug('Second Search Results', 'Fetched ' + assemblyItemData.length + ' assembly items.');

                    // Return the assembly item data
                    context.response.write(JSON.stringify({
                        assemblyItemData: assemblyItemData
                    }));
                    return;  // Exit after sending the second response
                }

            } catch (e) {
                log.error('Error in POST', e.message);
                context.response.write('Error: ' + e.message);
            }
        }
    }

    return {
        onRequest: onRequest
    };
});
