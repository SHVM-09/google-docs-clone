<script>
    import { onMount } from "svelte";
    import { EditorState } from "prosemirror-state";
    import { EditorView } from "prosemirror-view";
    import { Schema, DOMParser } from "prosemirror-model";
    import { schema } from "prosemirror-schema-basic";
    import { addListNodes } from "prosemirror-schema-list";
    import { exampleSetup } from "prosemirror-example-setup";
    import "prosemirror-view/style/prosemirror.css";

    let editorElement;
    let contentElement;
    let editorView;
    let response = null;
    let parsedContent = {};

    

// Initialize ProseMirror Editor
onMount(() => {
        if (!contentElement || !editorElement) {
            console.error("Editor or content element is missing!");
            return;
        }

        // Define custom marks
        const customMarks = {
            strong: {
                parseDOM: [{ tag: "strong" }, { tag: "b", getAttrs: () => null }],
                toDOM() {
                    return ["strong"];
                },
            },
            em: {
                parseDOM: [{ tag: "em" }, { tag: "i", getAttrs: () => null }],
                toDOM() {
                    return ["em"];
                },
            },
            underline: {
                parseDOM: [{ tag: "u" }],
                toDOM() {
                    return ["u"];
                },
            },
            link: {
                attrs: { href: {} },
                inclusive: false,
                parseDOM: [
                    {
                        tag: "a[href]",
                        getAttrs(dom) {
                            return { href: dom.getAttribute("href") };
                        },
                    },
                ],
                toDOM(mark) {
                    return ["a", { href: mark.attrs.href }];
                },
            },
            code: {
                parseDOM: [{ tag: "code" }],
                toDOM() {
                    return ["code"];
                },
            },
            text_color: {
                attrs: { color: { default: null } },
                parseDOM: [
                    {
                        style: "color",
                        getAttrs: (value) => ({ color: value }),
                    },
                ],
                toDOM(mark) {
                    return ["span", { style: `color: ${mark.attrs.color}` }, 0];
                },
            },
            text_size: {
            attrs: { size: { default: "14px" } },
            parseDOM: [
                {
                    style: "font-size",
                    getAttrs: (value) => ({ size: value }),
                },
            ],
            toDOM(mark) {
                return ["span", { style: `font-size: ${mark.attrs.size};` }, 0];
            },
        },
        };

        // Start with the basic schema
        const baseNodes = schema.spec.nodes;
        // Modify paragraph and heading nodes to include alignment
        const nodesWithAlignment = baseNodes.update(
            "paragraph",
            {
                content: "inline*",
                group: "block",
                attrs: { align: { default: "left" } },
                parseDOM: [{
                    tag: "p",
                    getAttrs(dom) {
                        return { align: dom.style.textAlign || "left" };
                    }
                }],
                toDOM(node) {
                    return ["p", { style: `text-align: ${node.attrs.align}` }, 0];
                }
            }
        ).update(
            "heading",
            {
                content: "inline*",
                group: "block",
                attrs: { 
                    level: { default: 1 },
                    align: { default: "left" }
                },
                parseDOM: Array.from({ length: 6 }, (_, i) => ({
                    tag: `h${i + 1}`,
                    getAttrs(dom) {
                        return { 
                            level: i + 1,
                            align: dom.style.textAlign || "left"
                        };
                    }
                })),
                toDOM(node) {
                    return [`h${node.attrs.level}`, 
                        { style: `text-align: ${node.attrs.align}` }, 
                        0
                    ];
                }
            }
        );

        // Create schema with list support and alignment
        const mySchema = new Schema({
            nodes: addListNodes(nodesWithAlignment, "paragraph block*", "block"),
            marks: {
                ...schema.spec.marks,
                ...customMarks
            }
        });

        // Initialize the ProseMirror editor
        editorView = new EditorView(editorElement, {
            state: EditorState.create({
                doc: DOMParser.fromSchema(mySchema).parse(contentElement),
                plugins: exampleSetup({ schema: mySchema }),
            }),
            dispatchTransaction(transaction) {
                // Log transaction steps and state before/after
                // console.log("Transaction Steps:", transaction.steps);
                // console.log("Transaction Doc Before:", transaction.before.toJSON());
                // console.log("Transaction Doc After:", transaction.doc.toJSON());

                // Apply the transaction to update the editor state
                const newState = editorView.state.apply(transaction);
                editorView.updateState(newState);

                // Call detectChanges to analyze steps
                // detectChanges(transaction);

                 // Prepare and send the batch update request to Google Docs
                sendBatchUpdateToGoogleDoc(transaction);
                
            }

        });

        return () => {
            editorView.destroy();
        };
    });

    let debounceTimer;
    let pendingRequests = [];

    // Helper function to map ProseMirror marks to Google Docs text styles
    function getTextStyleFromMark(mark, remove = false) {
        const textStyle = {};
        if (mark.type === "strong") {
            textStyle.bold = !remove; // Add or remove bold
        } else if (mark.type === "em") {
            textStyle.italic = !remove; // Add or remove italic
        } else if (mark.type === "underline") {
            textStyle.underline = !remove; // Add or remove underline
        }

        return textStyle;
    }

    // Helper to identify if a node is a list
    function isListNode(node) {
        return node.type === "bullet_list" || node.type === "ordered_list";
    }

    // Calculate the range for a list
    function getListRange(doc, pos) {
        const resolvedPos = doc.resolve(pos);
        const parent = resolvedPos.node(resolvedPos.depth);

        // Start and end positions of the parent node
        let start = resolvedPos.start(resolvedPos.depth);
        let end = resolvedPos.end(resolvedPos.depth);

        if (start === end) {
            end += 1; // Expand the range by one character/block
        }

        return { start, end };
    }

    async function sendBatchUpdateToGoogleDoc(transaction) {
        const documentId = "155FIoSa6hpvrRJHNKz825TIo-LTQMqfkggxAE0xYvsI";
        const userId = "12345";

        const newRequests = transaction.steps.map((step) => {
            const oldDoc = transaction.docs[0];
            const newDoc = transaction.docs[1];

            // Determine whether the current node is a heading
            const isHeadingNode = (doc, pos) => {
                const resolvedPos = doc.resolve(pos);
                const parentNode = resolvedPos.node(resolvedPos.depth);
                return parentNode?.type.name === "heading";
            };

            // `getActualPosition` function for heading nodes
            const getActualPositionForHeading = (doc, pos) => {
                let count = 1;
                doc.nodesBetween(1, pos, (node, nodePos) => {
                    if (nodePos >= pos) return false;
                    if (node.isText) {
                        const textLength = Math.min(node.text.length, pos - nodePos);
                        count += textLength;
                    }
                    if (node.isBlock && nodePos + node.nodeSize <= pos) {
                        count += 1; // Add newline for block nodes
                    }
                    return true;
                });
                return count;
            };

            // `getActualPosition` function for non-heading nodes
            const getActualPositionForNonHeading = (doc, pos) => {
                let count = 1;
                doc.nodesBetween(1, pos, (node, nodePos) => {
                    if (nodePos >= pos) return false;
                    if (node.isText) {
                        const textLength = Math.min(node.text.length, pos - nodePos);
                        count += textLength;
                    }
                    if (node.isBlock && nodePos + node.nodeSize <= pos) {
                        count += 1; // Add newline for block nodes
                    }
                    return true;
                });
                return count;
            };

            // Select the correct `getActualPosition` function
            const getActualPosition = (doc, pos) =>
                isHeadingNode(doc, pos)
                    ? getActualPositionForHeading(doc, pos)
                    : getActualPositionForNonHeading(doc, pos);


            // Handle List insertion or removal
            if (step.toJSON) {
                const stepData = step.toJSON();

                const startPos = getActualPosition(oldDoc, stepData.from);
                const endPos = getActualPosition(oldDoc, stepData.to);

                // Handle list creation for replaceAround
                if (stepData.stepType === "replaceAround" && stepData.slice?.content) {
                    const listContent = stepData.slice.content[0];
                    
                    if (listContent.type === "ordered_list" || listContent.type === "bullet_list") {
                        const isOrdered = listContent.type === "ordered_list";
                        const { start, end } = getListRange(oldDoc, stepData.from);

                        return {
                            createParagraphBullets: {
                                range: {
                                    startIndex: getActualPosition(oldDoc, start),
                                    endIndex: getActualPosition(oldDoc, end -1),
                                },
                                bulletPreset: isOrdered
                                    ? "NUMBERED_DECIMAL_ALPHA_ROMAN"
                                    : "BULLET_DISC_CIRCLE_SQUARE",
                            },
                        };
                    }
                }

                // Handle list removal
                if (stepData.stepType === "replaceAround" && !stepData.slice?.content) {
                    const startNode = oldDoc.nodeAt(stepData.from);

                    if (isListNode(startNode)) {
                        const { start, end } = getListRange(oldDoc, stepData.from);
                        return {
                            deleteParagraphBullets: {
                                range: {
                                    startIndex: getActualPosition(oldDoc, start),
                                    endIndex: getActualPosition(oldDoc, end),
                                },
                            },
                        };
                    }
                }
            }

            // Handle text insertion (including newlines)
            if (step.slice?.content && step.slice.content.size > 0 && !step.slice.content.child(0).type.name.includes("list")) {
                const actualPosition = getActualPosition(oldDoc, step.from);
                const insertedText = step.slice.content.textBetween(0, step.slice.content.size, "\n", "\n");

                return {
                    insertText: {
                        location: { index: actualPosition },
                        text: insertedText,
                    },
                };
            }

            // Handle text deletion or mark changes (bold, italic, underline)
            if (step.toJSON) {
                console.log("Step Details:", step.toJSON());
                const stepData = step.toJSON();
                console.log("Step Data:", stepData);
                if (stepData.stepType === "addMark" || stepData.stepType === "removeMark") {
                    const startPos = getActualPosition(oldDoc, stepData.from);
                    const endPos = getActualPosition(oldDoc, stepData.to);

                    const styleUpdate = getTextStyleFromMark(
                        stepData.mark,
                        stepData.stepType === "removeMark"
                    );

                    return {
                        updateTextStyle: {
                            range: {
                                startIndex: startPos,
                                endIndex: endPos,
                            },
                            textStyle: styleUpdate,
                            fields: Object.keys(styleUpdate).join(","),
                        },
                    };
                }
            }


            if (step.from !== step.to) {
                const startPos = getActualPosition(oldDoc, step.from);
                const endPos = getActualPosition(oldDoc, step.to);

                return {
                    deleteContentRange: {
                        range: {
                            startIndex: startPos,
                            endIndex: endPos,
                        },
                    },
                };
            }

            return null;
        }).filter(Boolean);

        if (!newRequests.length) {
            console.log("No changes to update.");
            return;
        }

        // Add to pending requests and handle debouncing
        pendingRequests.push(...newRequests);

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (!pendingRequests.length) return;

            try {
                const response = await fetch("http://localhost:3000/google-doc/batchUpdate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        documentId,
                        userId,
                        requests: pendingRequests,
                    }),
                });

                const result = await response.json();

                if (response.ok) {
                    console.log("Batch update successful:", result);
                } else {
                    console.error("Batch update failed:", result.error);
                }
            } catch (error) {
                console.error("Error sending batch update:", error);
            } finally {
                pendingRequests = [];
            }
        }, 1000);
    }

    
    function detectChanges(transaction) {
        transaction.steps.forEach((step, index) => {
            console.log(`Step ---------------- ${index + 1}:`, step);

            // Check if the step modifies a range in the document
            if (step.from !== undefined && step.to !== undefined) {
                console.log(
                    `Change from position ${step.from} to ${step.to} in the document.`
                );
            }

            // Check for added content
            if (step.slice?.content) {
                console.log("Slice of content added:", step.slice.content.toJSON());
            }

            // Log positional changes with the step map
            if (step.getMap) {
                console.log("Step Map:", step.getMap());
            }

            // General logging for all steps
            // console.log("Step Details:", step.toJSON ? step.toJSON() : step);
        });
    }


    // Log Editor Content
    function logEditorContent() {
        if (editorView) {
            const doc = editorView.state.doc.toJSON();
            console.log("ProseMirror Document:", doc);
        } else {
            console.error("Editor view is not initialized!");
        }
    }

    // Load Data from API
    async function loadData() {
        try {
            const docId = "155FIoSa6hpvrRJHNKz825TIo-LTQMqfkggxAE0xYvsI";
            const userId = "12345";
            const res = await fetch(
                `http://localhost:3000/google-doc?documentId=${docId}&userId=${userId}`,
            );
            const res2 = await res.json();
            response = res2.data;

            console.log("Fetched Data before convertion", response);
            // Convert the response to ProseMirror-compatible JSON
            const content = await convertToProseMirror(response);

            console.log("Fetched and Parsed Content:", content);

            if (editorView) {
                const { schema } = editorView.state;

                // Create a valid ProseMirror document node
                const doc = schema.nodeFromJSON(content);

                // Create a new editor state with the loaded document
                const state = EditorState.create({
                    doc,
                    plugins: exampleSetup({ schema }),
                });

                editorView.updateState(state); // Update the editor view with the new state
            }
        } catch (error) {
            console.error("Error fetching document:", error);
        }
    }

    // Convert Google Docs API data to ProseMirror format
    async function convertToProseMirror(data) {
    const content = [];
    let currentList = null;
    const lists = data.lists || {}; // Lists mapping
    const inlineObjects = data.inlineObjects || {}; // Inline objects mapping

    for (const item of data.body.content) {
        if (item.paragraph) {
            const paragraphContent = [];

            for (const element of item.paragraph.elements) {
                // Handle inline object elements (images)
                if (element.inlineObjectElement) {
                    const objectId = element.inlineObjectElement.inlineObjectId;
                    const inlineObject = inlineObjects[objectId];

                    if (
                        inlineObject?.inlineObjectProperties?.embeddedObject
                            ?.imageProperties
                    ) {
                        const imageUrl =
                            inlineObject.inlineObjectProperties.embeddedObject.imageProperties.contentUri;
                        const base64Src = await fetchImageAsBase64(imageUrl);

                        const imageNode = {
                            type: "image",
                            attrs: {
                                src: base64Src,
                                alt:
                                    inlineObject.inlineObjectProperties
                                        .embeddedObject.description || "",
                                title:
                                    inlineObject.inlineObjectProperties
                                        .embeddedObject.title || "",
                            },
                        };

                        paragraphContent.push(imageNode);
                    }
                }

                // Handle textRun elements
                if (element.textRun) {
                    let textValue = element.textRun.content;
                   
                    if (textValue && textValue.trim() !== "") {
                        textValue = textValue.replace(/\n$/g, '');
                    }

                    if (!textValue) continue;

                    const textRun = {
                        type: "text",
                        text: textValue,
                        marks: [],
                    };

                    if (textValue === '\n') {
                        // add a zero width space which prose mirror will handle correctly
                        textRun.text = '\u200b';
                    }
                    // Apply text styles
                    if (element.textRun.textStyle) {
                        // Font size (convert points to pixels)
                        const fontSizeInPoints =
                            element.textRun.textStyle.fontSize?.magnitude || 11; // Default to 11pt
                        const fontSizeInPixels = Math.round(fontSizeInPoints * 1.33); // Convert points to pixels
                        textRun.marks.push({
                            type: "text_size",
                            attrs: { size: `${fontSizeInPixels}px` },
                        });

                        // Bold text
                        if (element.textRun.textStyle.bold) {
                            textRun.marks.push({ type: "strong" });
                        }

                        // Italic text
                        if (element.textRun.textStyle.italic) {
                            textRun.marks.push({ type: "em" });
                        }

                        // Underlined text
                        if (element.textRun.textStyle.underline) {
                            textRun.marks.push({ type: "underline" });
                        }

                        // Links
                        if (element.textRun.textStyle.link) {
                            textRun.marks.push({
                                type: "link",
                                attrs: { href: element.textRun.textStyle.link.url },
                            });
                        }

                        // Foreground color
                        if (element.textRun.textStyle.foregroundColor?.color?.rgbColor) {
                            const rgb = element.textRun.textStyle.foregroundColor.color.rgbColor;
                            const red = rgb.red !== undefined ? Math.round(rgb.red * 255) : 0;
                            const green = rgb.green !== undefined ? Math.round(rgb.green * 255) : 0;
                            const blue = rgb.blue !== undefined ? Math.round(rgb.blue * 255) : 0;

                            const rgbColor = `rgb(${red}, ${green}, ${blue})`;
                            textRun.marks.push({
                                type: "text_color",
                                attrs: { color: rgbColor },
                            });
                        }
                    }

                    paragraphContent.push(textRun);
                }
            }

            // Determine alignment and type of block
            const alignment =
                item.paragraph.paragraphStyle?.alignment || "LEFT";
            const alignValue =
                alignment === "CENTER"
                    ? "center"
                    : alignment === "END"
                    ? "right"
                    : "left";

            let paragraphNode;
            const namedStyleType = item.paragraph.paragraphStyle?.namedStyleType;

            if (namedStyleType?.startsWith("HEADING_")) {
                paragraphNode = {
                    type: "heading",
                    attrs: {
                        level: parseInt(namedStyleType.split("_")[1], 10),
                        align: alignValue, // Apply alignment as an attribute
                    },
                    content: paragraphContent,
                };
            } else {
                paragraphNode = {
                    type: "paragraph",
                    attrs: {
                        align: alignValue, // Apply alignment as an attribute
                    },
                    content: paragraphContent,
                };
            }

            if (item.paragraph.bullet) {
                const listId = item.paragraph.bullet.listId;
                const listInfo = lists[listId];
                const nestingLevelIndex = item.paragraph.bullet.nestingLevel || 0;

                const nestingLevel =
                    listInfo?.listProperties?.nestingLevels?.[nestingLevelIndex];
                const listType =
                    nestingLevel?.glyphType === "GLYPH_TYPE_UNSPECIFIED"
                        ? "ordered_list"
                        : "bullet_list";

                const listItem = {
                    type: "list_item",
                    content: [paragraphNode],
                };

                if (!currentList || currentList.attrs.listId !== listId) {
                    if (currentList) {
                        content.push(currentList);
                    }

                    currentList = {
                        type: listType,
                        attrs: { listId },
                        content: [],
                    };
                }

                currentList.content.push(listItem);
            } else {
                if (currentList) {
                    content.push(currentList);
                    currentList = null;
                }

                // Push the paragraph or heading node if it is not part of a list 
                if (paragraphContent.length > 0) {
                    content.push(paragraphNode);
                }
            }
        }
    }

    if (currentList) {
        content.push(currentList);
    }

    return {
        type: "doc",
        content,
    };
}

    // Function to fetch and convert image to Base64
    async function fetchImageAsBase64(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error converting image to Base64:", error);
            return "";
        }
    }
</script>

<div>
    <!-- Placeholder for editor content -->
    <div id="content" bind:this={contentElement}>
        <p></p>
    </div>
    <!-- Editor container -->
    <div id="editor-container">
        <div id="editor" bind:this={editorElement}></div>
    </div>
    <!-- Buttons -->
    <div class="flex justify-center space-x-2 text-xs font-medium text-white">
        <button class="bg-blue-500 p-2 rounded" on:click={logEditorContent}
            >Log Content</button
        >
        <button class="bg-blue-500 p-2 rounded" on:click={loadData}
            >Load Doc</button
        >
    </div>
</div>

<style>
    #editor {
        background: white;
        color: black;
        background-clip: padding-box;
        border-radius: 4px;
        border: 2px solid rgba(0, 0, 0, 0.2);
        margin-bottom: 23px;
        margin: 20px;
        overflow: hidden;
        padding: 0px 40px;
    }

    #content {
        visibility: hidden;
        height: 0;
        overflow: hidden;
    }
    /* :global(.ProseMirror-trailingBreak){
        display: none;
    } */
     
    :global(.ProseMirror) {
        position: relative;
        font-size: 14px;
        height: 100%;
        word-wrap: break-word;
        white-space: pre-wrap;
        -webkit-font-variant-ligatures: none;
        font-variant-ligatures: none;
        outline: none;
        font-family: "Inter", sans-serif;
        line-height: normal;
        margin-top: 45px;
        width: 100%;
        min-height: 75vh;
    }
    :global(.ProseMirror-menubar-wrapper) {
        display: flex;
        padding: 0px 10px 10px 0px;
    }
    :global(.ProseMirror-menubar) {
        display: inline-block;
        position: absolute !important;
        padding: 5px;
        width: 100%;
        border-radius: 3px;
        z-index: 100;
    }
    :global(.ProseMirror-menuitem) {
        margin-right: 10px;
        display: inline-block;
    }
    :global(.prosemirror-icon) {
        display: inline-block;
        line-height: 0.8;
        vertical-align: -2px;
        padding: 2px 8px;
        cursor: pointer;
    }
    :global(.ProseMirror-icon svg) {
        height: 13px;
    }
    :global(.ProseMirror-menuseparator) {
        border-right: 1px solid #ddd;
        margin-right: 3px;
    }
    :global(.ProseMirror-menu-dropdown-wrap) {
        padding: 1px 0 1px 4px;
        display: inline-block;
        position: relative;
        z-index: 15;
    }
    :global(.ProseMirror-menu-dropdown) {
        vertical-align: 1px;
        cursor: pointer;
        position: relative;
        padding-right: 15px;
    }
    :global(.ProseMirror-menu-dropdown-menu, .ProseMirror-menu-submenu) {
        position: absolute;
        background-color: white;
        color: #666;
        border: 1px solid #aaa;
        padding: 2px;
        min-width: 120px;
    }
    :global(.placeholder::after) {
        position: absolute;
        transform: translateY(-18px) translateX(1px);
        content: attr(placeholder-text);
        cursor: text;
        color: #9ca3af;
    }

    :global(.ProseMirror pre) {
        white-space: pre-wrap;
    }

    :global(.ProseMirror li) {
        position: relative;
    }
    :global(.ProseMirror a) {
        color: blue;
    }

    :global(.ProseMirror-hideselection *::selection) {
        background: transparent;
    }

    :global(.ProseMirror-hideselection *::-moz-selection) {
        background: transparent;
    }

    :global(.ProseMirror-hideselection) {
        caret-color: transparent;
    }

    :global(.ProseMirror-selectednode) {
        outline: 2px solid #8cf;
    }

    :global(li.ProseMirror-selectednode) {
        outline: none;
    }

    :global(li.ProseMirror-selectednode:after) {
        content: "";
        position: absolute;
        left: -32px;
        right: -2px;
        top: -2px;
        bottom: -2px;
        border: 2px solid #8cf;
        pointer-events: none;
    }

    :global(.ProseMirror-gapcursor) {
        display: none;
        pointer-events: none;
        position: absolute;
    }

    :global(.ProseMirror-gapcursor:after) {
        content: "";
        display: block;
        position: absolute;
        top: -2px;
        width: 20px;
        border-top: 1px solid green;
        animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
    }

    @keyframes ProseMirror-cursor-blink {
        to {
            visibility: hidden;
        }
    }

    :global(.ProseMirror-focused .ProseMirror-gapcursor) {
        display: block;
    }

    :global(.ProseMirror ul) {
        padding-left: 30px;
        list-style: disc;
    }
    :global(.ProseMirror ol) {
        padding-left: 30px;
        list-style: decimal;
    }

    :global(.ProseMirror blockquote) {
        padding-left: 1em;
        border-left: 3px solid #eee;
        margin-left: 0;
        margin-right: 0;
    }

    :global(#editor),
    :global(.editor) {
        background: white;
        color: #374151;
        background-clip: padding-box;
        line-height: 1.5rem;
        border-radius: 4px;
        height: 100%;
    }

    :global(.ProseMirror p:first-child),
    :global(.ProseMirror h1:first-child),
    :global(.ProseMirror h2:first-child),
    :global(.ProseMirror h3:first-child),
    :global(.ProseMirror h4:first-child),
    :global(.ProseMirror h5:first-child),
    :global(.ProseMirror h6:first-child) {
        margin-top: 16px;
    }

    :global(.ProseMirror h1) {
        font-size: 32px;
    }
    :global(.ProseMirror h2) {
        font-size: 28px;
        margin-bottom: 10px;
    }
    :global(.ProseMirror h3) {
        font-size: 24px;
    }
    :global(.ProseMirror h4) {
        font-size: 20px;
    }
    :global(.ProseMirror h5) {
        font-size: 18px;
    }
    :global(.ProseMirror h6) {
        font-size: 16px;
    }

    :global(.ProseMirror p) {
        margin-bottom: 1em;
    }

    :global(.ProseMirror > .ProseMirror-yjs-cursor:first-child) {
        margin-top: 16px;
    }

    :global(.ProseMirror-yjs-cursor) {
        position: relative;
        margin-left: -1px;
        margin-right: -1px;
        border-left: 1px solid black;
        border-right: 1px solid black;
        border-color: orange;
        word-break: normal;
        pointer-events: none;
    }

    :global(.ProseMirror-yjs-cursor > div) {
        position: absolute;
        top: -1.05em;
        left: -1px;
        font-size: 13px;
        background-color: rgb(250, 129, 0);
        font-family: serif;
        font-style: normal;
        font-weight: normal;
        line-height: normal;
        user-select: none;
        color: white;
        padding-left: 2px;
        padding-right: 2px;
        white-space: nowrap;
    }

    :global(strong) {
        font-weight: 600;
    }
</style>