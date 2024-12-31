<script>
  import { onMount } from "svelte";

  let response;
  let parsedPages = []; // To store parsed pages with section break handling
  let namedStyles = {}; // To store named styles from the document

  // Utility function to parse text style
  const parseTextStyle = (textStyle) => {
    if (!textStyle) return "";
    const { bold, italic, underline, fontSize, foregroundColor, backgroundColor } = textStyle;

    const color = foregroundColor?.color?.rgbColor
      ? `rgb(${Math.round(foregroundColor.color.rgbColor.red * 255 || 0)}, 
             ${Math.round(foregroundColor.color.rgbColor.green * 255 || 0)}, 
             ${Math.round(foregroundColor.color.rgbColor.blue * 255 || 0)})`
      : "inherit";

    const bgColor = backgroundColor?.color?.rgbColor
      ? `rgb(${Math.round(backgroundColor.color.rgbColor.red * 255 || 0)}, 
             ${Math.round(backgroundColor.color.rgbColor.green * 255 || 0)}, 
             ${Math.round(backgroundColor.color.rgbColor.blue * 255 || 0)})`
      : "transparent";

    const fontSizeStyle = fontSize?.magnitude ? `${Math.round(fontSize.magnitude)}px` : "inherit";

    return `
      font-weight: ${bold ? "bold" : "normal"}; 
      font-style: ${italic ? "italic" : "normal"}; 
      text-decoration: ${underline ? "underline" : "none"};
      font-size: ${fontSizeStyle};
      color: ${color};
      background-color: ${bgColor};
    `;
  };

  // Utility function to parse named styles
  const parseNamedStyle = (styleType) => {
    const style = namedStyles[styleType];
    if (!style) return "";

    const textStyle = parseTextStyle(style.textStyle || {});
    const paragraphStyle = style.paragraphStyle || {};

    return `
      ${textStyle}
      margin-top: ${Math.round(paragraphStyle.spaceAbove?.magnitude || 0)}px;
      margin-bottom: ${Math.round(paragraphStyle.spaceBelow?.magnitude || 0)}px;
      text-align: ${paragraphStyle.alignment?.toLowerCase() || "left"};
    `;
  };

  const parseTableCellStyle = (cell, paragraphAlignment) => {
    const backgroundColor = cell.backgroundColor
      ? `rgb(${Math.round(cell.backgroundColor.red * 255 || 0)}, 
             ${Math.round(cell.backgroundColor.green * 255 || 0)}, 
             ${Math.round(cell.backgroundColor.blue * 255 || 0)})`
      : "transparent";

    const borderColor = cell.borderColor
      ? `rgb(${Math.round(cell.borderColor.red * 255 || 0)}, 
             ${Math.round(cell.borderColor.green * 255 || 0)}, 
             ${Math.round(cell.borderColor.blue * 255 || 0)})`
      : "transparent";

    const alignment = paragraphAlignment?.toLowerCase() || "left";

    const padding = `
      padding-left: ${Math.round(cell.tableCellStyle?.paddingLeft?.magnitude || 0)}px;
      padding-right: ${Math.round(cell.tableCellStyle?.paddingRight?.magnitude || 0)}px;
      padding-top: ${Math.round(cell.tableCellStyle?.paddingTop?.magnitude || 0)}px;
      padding-bottom: ${Math.round(cell.tableCellStyle?.paddingBottom?.magnitude || 0)}px;
    `;

    const paragraphStyle = cell.content?.[0]?.paragraph?.paragraphStyle || {};
    const namedStyleType = paragraphStyle.namedStyleType || "NORMAL_TEXT";
    const namedStyle = namedStyles[namedStyleType]?.textStyle || {};

    const textStyle = cell.content?.[0]?.paragraph?.elements?.[0]?.textRun?.textStyle || namedStyle;
    const fontSize = textStyle?.fontSize?.magnitude
      ? `${Math.round(textStyle.fontSize.magnitude)}px`
      : "inherit";

    const lineSpacing = paragraphStyle.lineSpacing ? `${Math.round(paragraphStyle.lineSpacing)}%` : "normal";

    return `
      background-color: ${backgroundColor};
      border: 1px solid ${borderColor};
      text-align: ${alignment};
      font-size: ${fontSize};
      line-height: ${lineSpacing};
      ${padding}
    `;
  };

  const replaceTabsAndSpaces = (text) => {
    return text.replace(/ /g, " ").replace(/\t/g, "    ");
  };

  const renderTableContent = (content) =>
    content
      .map((element) =>
        element.link
          ? `<a href="${element.link}" style="${parseTextStyle(element.textStyle)}">${replaceTabsAndSpaces(
              element.content
            )}</a>`
          : `<span style="${parseTextStyle(element.textStyle)}">${replaceTabsAndSpaces(element.content)}</span>`
      )
      .join("");

  const extractContent = (data) => {
    if (!data) return [];
    console.log(data);
    
    const pageSize = data.documentStyle.pageSize || {};
    const margins = {
      marginTop: Math.round(data.documentStyle.marginTop?.magnitude || 0),
      marginBottom: Math.round(data.documentStyle.marginBottom?.magnitude || 0),
      marginLeft: Math.round(data.documentStyle.marginLeft?.magnitude || 0),
      marginRight: Math.round(data.documentStyle.marginRight?.magnitude || 0),
    };
    const defaultPageStyle = {
      width: `${Math.round(pageSize.width?.magnitude || 612)}px`,
      height: `${Math.round(pageSize.height?.magnitude || 792)}px`,
      "background-color": data.background?.color?.rgbColor
        ? `rgb(${Math.round(data.background.color.rgbColor.red * 255 || 0)}, 
               ${Math.round(data.background.color.rgbColor.green * 255 || 0)}, 
               ${Math.round(data.background.color.rgbColor.blue * 255 || 0)})`
        : "white",
      marginTop: `${margins.marginTop}px`,
      marginBottom: `${margins.marginBottom}px`,
    };

    let currentPage = {
      content: [],
      style: { ...defaultPageStyle },
    };

    const pages = [currentPage];
    let firstSectionBreakSkipped = false; // Flag to skip the first section break

    namedStyles = data.namedStyles?.styles.reduce((acc, style) => {
      acc[style.namedStyleType] = style;
      return acc;
    }, {});

    console.log(namedStyles);

    const content = data.body?.content || [];
    const lists = data.lists || {};
    const inlineObjects = data.inlineObjects || {};

    const listMap = {};

    content.forEach((block) => {
      if (block.sectionBreak) {
        if (!firstSectionBreakSkipped) {
          firstSectionBreakSkipped = true; // Skip the first section break
          return;
        }

        const sectionStyle = block.sectionBreak.sectionStyle || {};
        currentPage = {
          content: [],
          style: {
            width: `${Math.round(sectionStyle.pageWidth?.magnitude || pageSize.width?.magnitude || 612)}px`,
            height: `${Math.round(sectionStyle.pageHeight?.magnitude || pageSize.height?.magnitude || 792)}px`,
            "background-color": data.background?.color?.rgbColor
              ? `rgb(${Math.round(data.background.color.rgbColor.red * 255 || 0)}, 
                     ${Math.round(data.background.color.rgbColor.green * 255 || 0)}, 
                     ${Math.round(data.background.color.rgbColor.blue * 255 || 0)})`
              : "white",
            marginTop: `${margins.marginTop}px`,
            marginBottom: `${margins.marginBottom}px`,
          },
        };
        pages.push(currentPage);
      } else {
        const paragraph = block?.paragraph;

        if (!paragraph || !paragraph.elements) {
          const table = block?.table;
          if (table) {
            const columnWidths = table.tableStyle?.tableColumnProperties?.map(
              (col) => `${Math.round(col.width.magnitude)}pt`
            );
            const rows = table.tableRows.map((row) =>
              row.tableCells.map((cell, columnIndex) => {
                const cellAlignment =
                  cell.content?.[0]?.paragraph?.paragraphStyle?.alignment || "LEFT";
                return {
                  content: cell.content.flatMap((p) =>
                    p.paragraph.elements.map((el) => ({
                      content: el.textRun?.content || "",
                      textStyle: el.textRun?.textStyle || {},
                      link: el.textRun?.textStyle?.link?.url || null,
                    }))
                  ),
                  backgroundColor: cell.tableCellStyle?.backgroundColor?.color?.rgbColor,
                  borderColor: cell.tableCellStyle?.borderColor?.color?.rgbColor,
                  alignment: cellAlignment,
                  tableCellStyle: cell.tableCellStyle,
                  columnWidth: columnWidths?.[columnIndex] || "auto",
                };
              })
            );

            currentPage.content.push({ type: "table", rows, columnWidths });
          }
          return;
        }

        if (paragraph.bullet) {
          const listId = paragraph.bullet.listId;
          const nestingLevel = paragraph.bullet.nestingLevel || 0;

          const glyphType =
            lists[listId]?.listProperties?.nestingLevels?.[nestingLevel]?.glyphType || "DISC";

          const alignment = paragraph.paragraphStyle?.alignment || "LEFT";

          if (!listMap[listId]) listMap[listId] = [];
          const textContent = paragraph.elements
            .map((el) => replaceTabsAndSpaces(el.textRun?.content || ""))
            .join("");

          if (textContent) {
            listMap[listId].push({
              text: textContent,
              textStyle: paragraph.elements[0]?.textRun?.textStyle || {},
              nestingLevel,
              glyphType,
            });
          }

          if (!currentPage.content.some((item) => item.listId === listId)) {
            currentPage.content.push({
              type: "list",
              listId,
              alignment,
              namedStyle: paragraph.paragraphStyle?.namedStyleType || "NORMAL_TEXT",
            });
          }
        } else {
          const hasInlineObject = paragraph.elements.some(
            (el) =>
              el.inlineObjectElement &&
              inlineObjects[el.inlineObjectElement.inlineObjectId]
          );

          if (hasInlineObject) {
            for (const element of paragraph.elements) {
              if (element.inlineObjectElement) {
                const inlineObjectId = element.inlineObjectElement.inlineObjectId;
                const embeddedObject =
                  inlineObjects[inlineObjectId]?.inlineObjectProperties
                    ?.embeddedObject;

                const alignment = paragraph.paragraphStyle?.alignment || "LEFT";

                if (embeddedObject?.imageProperties) {
                  currentPage.content.push({
                    type: "image",
                    src: embeddedObject.imageProperties.contentUri,
                    width: Math.round(embeddedObject.size?.width?.magnitude || 100),
                    height: Math.round(embeddedObject.size?.height?.magnitude || 100),
                    marginTop: Math.round(embeddedObject.marginTop?.magnitude || 0),
                    marginBottom: Math.round(embeddedObject.marginBottom?.magnitude || 0),
                    marginLeft: Math.round(embeddedObject.marginLeft?.magnitude || 0),
                    marginRight: Math.round(embeddedObject.marginRight?.magnitude || 0),
                    alt: embeddedObject.description || "",
                    alignment,
                  });
                }
              }
            }
          } else {
            const textElements = paragraph.elements.map((el) => {
              if (el.equation) {
                console.log(el.equation);
                return {
                  content: "Equation",
                  isEquation: true,
                  equationDetails: el.equation.suggestedInsertionIds,
                };
              }

              return {
                content: el?.textRun?.content || "",
                textStyle: el?.textRun?.textStyle || {},
                link: el?.textRun?.textStyle?.link?.url || null,
              };
            });

            const alignment = paragraph.paragraphStyle?.alignment || "LEFT";

            if (textElements.length > 0) {
              currentPage.content.push({
                type: "p",
                content: textElements,
                indentStart: Math.round(paragraph.indentStart?.magnitude || 0),
                spaceAbove: Math.round(paragraph.spaceAbove?.magnitude || 0),
                spaceBelow: Math.round(paragraph.spaceBelow?.magnitude || 0),
                alignment,
                namedStyle: paragraph.paragraphStyle?.namedStyleType || "NORMAL_TEXT",
              });
            }
          }
        }
      }
    });

    pages.forEach((page) => {
      page.content.forEach((block, index) => {
        if (block.type === "list") {
          const listId = block.listId;
          const items = listMap[listId];
          const root = [];
          const stack = [];

          items.forEach((item) => {
            while (
              stack.length > 0 &&
              stack[stack.length - 1].nestingLevel >= item.nestingLevel
            ) {
              stack.pop();
            }

            if (stack.length === 0) {
              root.push(item);
            } else {
              const parent = stack[stack.length - 1];
              if (!parent.children) parent.children = [];
              parent.children.push(item);
            }

            stack.push(item);
          });

          page.content[index] = { type: "list", items: root, alignment: block.alignment, namedStyle: block.namedStyle };
        }
      });
    });

    return pages;
  };

  const renderList = (list, namedStyle = "NORMAL_TEXT") => {
    if (!list.items || !Array.isArray(list.items)) return "";
    return `
      <ul class="list-none ml-8" style="text-align: ${list.alignment?.toLowerCase() || "left"}; ${parseNamedStyle(namedStyle)}">
        ${list.items
          .map(
            (item) => `
          <li class="list-inside" style="list-style-type: ${getGlyphType(item.glyphType)}; ${parseNamedStyle(namedStyle)}">
            <span style="${parseTextStyle(item.textStyle)}">
              ${item.text}
            </span>
            ${
              item.children
                ? renderList({ type: "list", items: item.children, alignment: list.alignment }, namedStyle)
                : ""
            }
          </li>`
          )
          .join("")}
      </ul>
    `;
  };

  const getGlyphType = (glyphType) => {
    switch (glyphType) {
      case "DECIMAL":
        return "decimal";
      case "ROMAN":
        return "upper-roman";
      case "ALPHA":
        return "lower-alpha";
      case "BULLET":
      default:
        return "disc";
    }
  };

  onMount(async () => {
    try {
      const docId = "1pS0tgwZquiHhn0PKT0KxGrfRw8Og61FD4VTx4XCvWPg";
      const userId = "12345";
      const res = await fetch(
        `http://localhost:3000/google-doc?documentId=${docId}&userId=${userId}`
      );
      const res2 = await res.json();
      response = res2.data;
      parsedPages = extractContent(response);
    } catch (error) {
      console.error("Error fetching document:", error);
    }
  });
</script>

<div class="min-h-screen bg-gray-100 flex flex-col items-center">
  {#each parsedPages as page}
    <div 
      class="shadow-lg border border-gray-300 p-4" 
      style={`box-sizing: border-box; margin-top: ${page.style.marginTop}; ${Object.entries(page.style).map(([key, value]) => `${key}: ${value};`).join(" ")}`}>
      {#each page.content as block}
        {#if block.type === "p"}
          <p
            class="text-base leading-6 min-h-4"
            style={`margin-left: ${block.indentStart}px; ${parseNamedStyle(block.namedStyle)}`}
          >
            {#each block.content as element}
              {#if element.isEquation}
                <span class="text-red-500 italic">"{element.equationDetails || "no suggest id found"}"</span>
              {:else if element.link}
                <a href={element.link} target="_blank" style={`${parseTextStyle(element.textStyle)} font-size: inherit;`}>
                  {replaceTabsAndSpaces(element.content)}
                </a>
              {:else}
                <span style={`${parseTextStyle(element.textStyle)} font-size: inherit;`}>
                  {replaceTabsAndSpaces(element.content)}
                </span>
              {/if}
            {/each}
          </p>
        {:else if block.type === "list"}
          {@html renderList(block, block.namedStyle)}
        {:else if block.type === "image"}
          <div
            class="image-container"
            style={`
              display: ${block.alignment === "CENTER" ? "block" : "inline-block"};
              text-align: ${block.alignment === "CENTER" ? "center" : "inherit"};
              margin-top: ${block.marginTop}px;
              margin-bottom: ${block.marginBottom}px;
            `}
          >
            <img
              src={block.src}
              alt={block.alt}
              width={block.width}
              height={block.height}
              style={`
                margin-left: ${block.alignment === "CENTER" ? "auto" : block.marginLeft + "px"};
                margin-right: ${block.alignment === "CENTER" ? "auto" : block.marginRight + "px"};
                display: ${block.alignment === "CENTER" ? "block" : "inline-block"};
              `}
            />
          </div>
        {:else if block.type === "table"}
          <table
            class="table-auto border-collapse"
            style="border: 1px solid transparent;"
          >
            <tbody>
              {#each block.rows as row}
                <tr>
                  {#each row as cell, columnIndex}
                    <td
                      style={`${parseTableCellStyle(cell, cell.alignment)} width: ${block.columnWidths[columnIndex]};`}
                    >
                      {@html renderTableContent(cell.content)}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/each}
    </div>
  {/each}
</div>
