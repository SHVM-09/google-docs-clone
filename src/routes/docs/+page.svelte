<script>
  import { onMount } from "svelte";

  let response;
  let parsedContent = [];

  // Utility function to parse text style
  const parseTextStyle = (textStyle) => {
  if (!textStyle) return "";
  const { bold, italic, underline, fontSize, foregroundColor } = textStyle;

  const color = foregroundColor?.color?.rgbColor
    ? `rgb(${Math.round(foregroundColor.color.rgbColor.red * 255 || 0)}, 
           ${Math.round(foregroundColor.color.rgbColor.green * 255 || 0)}, 
           ${Math.round(foregroundColor.color.rgbColor.blue * 255 || 0)})`
    : "inherit";

  return `
    font-weight: ${bold ? "bold" : "normal"}; 
    font-style: ${italic ? "italic" : "normal"}; 
    text-decoration: ${underline ? "underline" : "none"};
    font-size: ${fontSize?.magnitude || 16}px; 
    color: ${color};
  `;
};


  const parseTableCellStyle = (cell) => {
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

    return `background-color: ${backgroundColor}; border: 1px solid ${borderColor};`;
  };

  const extractContent = (data) => {
    if (!data) return [];
    const content = data.body?.content || [];
    const lists = data.lists || {};
    const inlineObjects = data.inlineObjects || {};

    const parsed = [];
    const listMap = {};

    content.forEach((block) => {
      const paragraph = block?.paragraph;

      if (!paragraph || !paragraph.elements) {
        const table = block?.table;
        if (table) {
          const rows = table.tableRows.map((row) =>
            row.tableCells.map((cell) => ({
              content: cell.content.flatMap((p) =>
                p.paragraph.elements.map((el) => ({
                  content: el.textRun?.content || "",
                  textStyle: el.textRun?.textStyle || {},
                  link: el.textRun?.textStyle?.link?.url || null,
                }))
              ),
              backgroundColor: cell.tableCellStyle?.backgroundColor?.color
                ?.rgbColor,
              borderColor: cell.tableCellStyle?.borderColor?.color?.rgbColor,
            }))
          );

          parsed.push({ type: "table", rows });
        }
        return;
      }

      if (paragraph.bullet) {
        const listId = paragraph.bullet.listId;
        const nestingLevel = paragraph.bullet.nestingLevel || 0;

        const glyphType =
          lists[listId]?.listProperties?.nestingLevels?.[nestingLevel]
            ?.glyphType || "DISC";

        if (!listMap[listId]) listMap[listId] = [];
        const textContent = paragraph.elements.map((el) =>
          el.textRun?.content || ""
        ).join("");

        if (textContent) {
          listMap[listId].push({
            text: textContent,
            textStyle: paragraph.elements[0]?.textRun?.textStyle || {},
            nestingLevel,
            glyphType,
          });
        }

        if (!parsed.some((item) => item.listId === listId)) {
          parsed.push({ type: "list", listId });
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

              if (embeddedObject?.imageProperties) {
                parsed.push({
                  type: "image",
                  src: embeddedObject.imageProperties.contentUri,
                  width: embeddedObject.size?.width?.magnitude || 100,
                  height: embeddedObject.size?.height?.magnitude || 100,
                  marginTop: embeddedObject.marginTop?.magnitude || 0,
                  marginBottom: embeddedObject.marginBottom?.magnitude || 0,
                  marginLeft: embeddedObject.marginLeft?.magnitude || 0,
                  marginRight: embeddedObject.marginRight?.magnitude || 0,
                  alt: embeddedObject.description || "",
                });
              }
            }
          }
        } else {
          const textElements = paragraph.elements.map((el) => ({
            content: el?.textRun?.content || "",
            textStyle: el?.textRun?.textStyle || {},
            link: el?.textRun?.textStyle?.link?.url || null,
          }));

          if (textElements.length > 0) {
            parsed.push({
              type: "p",
              content: textElements,
              indentStart: paragraph.indentStart?.magnitude || 0,
              spaceAbove: paragraph.spaceAbove?.magnitude || 0,
              spaceBelow: paragraph.spaceBelow?.magnitude || 0,
            });
          }
        }
      }
    });

    parsed.forEach((block, index) => {
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

        parsed[index] = { type: "list", items: root };
      }
    });

    return parsed;
  };

  const renderList = (list) => {
    return `
      <ul class="list-none ml-8">
        ${list.items
          .map(
            (item) => `
          <li style="list-style-type: ${getGlyphType(item.glyphType)};">
            <span style="${parseTextStyle(item.textStyle)}">
              ${item.text}
            </span>
            ${
              item.children
                ? renderList({ type: "list", items: item.children })
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
      parsedContent = extractContent(response);
    } catch (error) {
      console.error("Error fetching document:", error);
    }
  });
</script>

<div class="min-h-screen bg-gray-100 flex justify-center items-center py-10">
  <div class="bg-white w-[8.5in] h-[11in] shadow-lg border border-gray-300 p-8 rounded-md overflow-auto">
    <div class="space-y-4">
      {#each parsedContent as block}
        {#if block.type === "p"}
          <p
            class="text-base leading-6 min-h-4"
            style={`margin-top: ${block.spaceAbove}px; margin-left: ${block.indentStart}px; margin-bottom: ${block.spaceBelow}px;`}
          >
            {#each block.content as element}
              {#if element.link}
                <a href={element.link} target="_blank" style={`${parseTextStyle(element.textStyle)}`}>
                  {element.content.replace(/ /g, " ")}
                </a>
              {:else}
                <span style={`${parseTextStyle(element.textStyle)}`}>
                  {element.content.replace(/ /g, " ")}
                </span>
              {/if}
            {/each}
          </p>
        {:else if block.type === "list"}
          {@html renderList(block)}
        {:else if block.type === "image"}
          <img
            src={block.src}
            alt={block.alt}
            width={block.width}
            height={block.height}
            style={`margin-top: ${block.marginTop}px; margin-bottom: ${block.marginBottom}px; margin-left: ${block.marginLeft}px; margin-right: ${block.marginRight}px;`}
          />
        {:else if block.type === "table"}
          <table
            class="table-auto border-collapse w-full"
            style={`border: 1px solid ${block.borderColor || "#ccc"};`}
          >
            <tbody>
              {#each block.rows as row}
                <tr>
                  {#each row as cell}
                    <td style={parseTableCellStyle(cell)} class="p-2">
                      {#each cell.content as element}
                        {#if element.link}
                          <a href={element.link} target="_blank" style={`${parseTextStyle(element.textStyle)}`}>
                            {element.content.replace(/ /g, " ")}
                          </a>
                        {:else}
                          <span style={`${parseTextStyle(element.textStyle)}`}>
                            {element.content.replace(/ /g, " ")}
                          </span>
                        {/if}
                      {/each}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/each}
    </div>
  </div>
</div>
