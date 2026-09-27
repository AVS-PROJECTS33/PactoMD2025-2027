
const document = {
    addEventListener: (event, cb) => {
        global.run = cb;
    },
    getElementById: (id) => {
        if (id === 'pacto-data') return { textContent: 'CAPITULO 1\nArtículo 1\nHola mundo' };
        if (id === 'articles-container') return { innerHTML: '', appendChild: () => {} };
        return { innerHTML: '', appendChild: () => {}, querySelectorAll: () => [], classList: {add:()=>{}, remove:()=>{}}, addEventListener: ()=>{} };
    },
    createElement: () => {
        return { classList: {add:()=>{}, remove:()=>{}}, innerHTML: '', dataset: {} };
    }
};
const window = { matchMedia: () => ({matches: false}) };
const localStorage = { getItem: () => null, setItem: () => {} };

    
        document.addEventListener('DOMContentLoaded', () => {
            const rawData = document.getElementById('pacto-data').textContent;
            
            // Dividir el texto grande en artículos, capítulos, disposición adicional y anexos
            let parsedArticles = [];
            
            if (rawData.trim().startsWith('[')) {
                try {
                    parsedArticles = JSON.parse(rawData);
                } catch(e) {
                    console.error("Error parsing JSON data", e);
                }
            } else {
                // Limpiamos los tags de paginación antes de dividir el texto
                const cleanedData = rawData.replace(/\[Page \d+\]/g, '').replace(/\n\d+\n/g, '\n');

                // Usamos un negative lookahead (?!\d+\.\d+) para NO dividir sub-artículos como "Artículo 10.1"
                const chunkRegex = /(?=\n(?:(?:CAPITULO|Artículo|Articulo)\s+(?!\d+\.\d+)|ANEXO|DISPOSICIÓN ADICIONAL))/i;
                parsedArticles = cleanedData.split(chunkRegex).map(chunk => {
                    let text = chunk.trim();
                    if (text.length > 20) {
                        return {
                            title: extractTitle(text),
                            contentHtml: formatParagraphs(text) // We format it once
                        };
                    }
                    return null;
                }).filter(Boolean);
            }

            const container = document.getElementById('articles-container');
            const searchInput = document.getElementById('search-input');
            let isEditMode = false;

            function extractTitle(text) {
                const lines = text.split('\n');
                let title = lines[0].trim();
                for (let line of lines) {
                    if (line.trim().length > 0) {
                        title = line.trim();
                        break;
                    }
                }
                if(title.toLowerCase().includes('índice')) return 'Índice de Contenidos';
                return title.substring(0, 150) + (title.length > 150 ? '...' : '');
            }

            function removeAccents(str) {
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            }

            function createAccentInsensitiveRegex(word) {
                const accentMap = {
                    'a': '[aáàäâ]', 'e': '[eéèëê]', 'i': '[iíìïî]', 'o': '[oóòöô]', 'u': '[uúùüû]',
                    'n': '[nñ]', 'c': '[cç]'
                };
                const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = escaped.split('').map(char => accentMap[char.toLowerCase()] || char).join('');
                return new RegExp(`(${pattern})`, 'gi');
            }

            function formatParagraphs(text) {
                const lines = text.split('\n');
                let formatted = [];
                let currentParagraph = [];
                let currentStyle = 'parrafo-normal';
                let inTable = false;
                let tableHtml = '';

                function pushCurrent() {
                    if (currentParagraph.length > 0) {
                        formatted.push(`<p class="${currentStyle}">${currentParagraph.join(' ')}</p>`);
                        currentParagraph = [];
                        currentStyle = 'parrafo-normal';
                    }
                }

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    if (line.trim() === '') continue;
                    
                    let trimmedLine = line.trim();
                    
                    // Si la línea empieza por | es una tabla o parte del índice
                    const isTableLine = trimmedLine.startsWith('|');
                    
                    if (isTableLine) {
                        if (!inTable) {
                            pushCurrent();
                            inTable = true;
                            tableHtml = '<div class="overflow-x-auto mb-6 mt-2"><table class="w-full text-sm text-left border-collapse border border-gray-300 shadow-sm">';
                        }
                        
                        let inner = trimmedLine;
                        if (inner.endsWith('|')) {
                            inner = inner.substring(1, inner.length - 1);
                        } else {
                            inner = inner.substring(1);
                        }
                        let cells = inner.split('|');
                        
                        tableHtml += '<tr class="border-b border-gray-200 hover:bg-gray-50">';
                        if (cells.length === 1) {
                            let content = cells[0].trim();
                            // Separar el número de página si es una línea de índice mal escaneada
                            let match = content.match(/(.+?)\s+(\d+)$/);
                            if (match) {
                                tableHtml += `<td class="px-4 py-3">${match[1].trim()}</td><td class="px-4 py-3 text-right font-medium text-gray-500 w-16">${match[2]}</td>`;
                            } else {
                                tableHtml += `<td class="px-4 py-3" colspan="2">${content}</td>`;
                            }
                        } else {
                            cells.forEach(cell => {
                                tableHtml += `<td class="px-4 py-3 border-r border-gray-200 last:border-0">${cell.trim()}</td>`;
                            });
                        }
                        tableHtml += '</tr>';
                        continue;
                    } else {
                        if (inTable) {
                            tableHtml += '</table></div>';
                            formatted.push(tableHtml);
                            inTable = false;
                            tableHtml = '';
                        }
                    }

                    const isNumberList = /^\d+\.\s/.test(trimmedLine);
                    const isLetterList = /^[a-z]\)/.test(trimmedLine);
                    const isBulletList = /^[-•*]\s|^o\s+(?=[A-Z0-9ÁÉÍÓÚ])/.test(trimmedLine);
                    
                    let isListItem = isNumberList || isLetterList || isBulletList;
                    const prevLine = currentParagraph.length > 0 ? currentParagraph[currentParagraph.length - 1] : '';
                    const prevEndsWithPunctuation = /[.:;]$/.test(prevLine.trim().replace(/\[\[ENDHIGHLIGHT\]\]/g, ''));
                    const isHeader = /^(?:CAPITULO|Artículo|Articulo|ANEXO|DISPOSICIÓN ADICIONAL)/i.test(trimmedLine);
                    const prevWasHeader = currentStyle === 'articulo-titulo';
                    
                    // Si la línea anterior no tiene puntuación de fin de frase, no rompemos el párrafo
                    if (isListItem && currentParagraph.length > 0 && !prevEndsWithPunctuation && !prevWasHeader) {
                        isListItem = false;
                    }
                    
                    if (currentParagraph.length === 0 || prevEndsWithPunctuation || prevWasHeader || isListItem || isHeader) {
                        pushCurrent();
                        currentParagraph = [trimmedLine];
                        
                        if (isLetterList) {
                            currentStyle = 'lista-letra';
                        } else if (isNumberList) {
                            currentStyle = 'lista-numero';
                        } else if (isBulletList) {
                            currentStyle = 'lista-letra';
                        } else if (isHeader) {
                            currentStyle = 'articulo-titulo';
                        }
                    } else {
                        currentParagraph.push(trimmedLine);
                    }
                }
                
                if (inTable) {
                    tableHtml += '</table></div>';
                    formatted.push(tableHtml);
                } else {
                    pushCurrent();
                }
                
                let htmlResult = formatted.join('');
                
                // Resaltar títulos de listas (desde la viñeta hasta los dos puntos)
                // Excluimos las viñetas redondas para que no se resalten solas si tienen dos puntos
                htmlResult = htmlResult.replace(/(<p class="lista-(?:letra|numero)">)((?:[a-z]\)|[0-9]+\.)\s+[^:]{1,150}:)/gi, '$1<span class="underline underline-offset-2 decoration-[#FF5000]/40 font-bold">$2</span>');
                
                return htmlResult;
            }

            function renderArticles(filter = '') {
                if (isEditMode) return;
                
                container.innerHTML = '';
                const keywords = removeAccents(filter).toLowerCase().split(/\s+/).filter(w => w.length > 0);
                let foundCount = 0;

                parsedArticles.forEach((article, index) => {
                    const plainText = article.title + " " + article.contentHtml.replace(/<[^>]*>?/gm, '');
                    const articleTextNormalized = removeAccents(plainText).toLowerCase();
                    
                    const isMatch = keywords.length === 0 || keywords.every(kw => articleTextNormalized.includes(kw));
                    if (!isMatch) return;

                    foundCount++;
                    const title = article.title;
                    const isCapitulo = /^CAPITULO/i.test(title);
                    
                    let contentHtml = article.contentHtml;

                    if (keywords.length > 0) {
                        keywords.forEach(kw => {
                            const regex = createAccentInsensitiveRegex(kw);
                            contentHtml = contentHtml.replace(regex, '[[HIGHLIGHT]]$1[[ENDHIGHLIGHT]]');
                        });
                    }

                    contentHtml = contentHtml.replace(/\[\[HIGHLIGHT\]\]/g, '<span class="bg-yellow-300 text-black font-bold px-1 rounded shadow-sm highlight">').replace(/\[\[ENDHIGHLIGHT\]\]/g, '</span>');

                    const item = document.createElement('div');
                    item.className = 'article-item';
                    item.dataset.index = index;
                    
                    if (isCapitulo) {
                        item.classList.add('my-8');
                        let contentWithoutTitle = contentHtml.replace(/<p class="articulo-titulo">.*?<\/p>/, '').trim();
                        item.innerHTML = `
                            <div class="border-b-2 border-[#FF5000] pb-2 mb-4 article-title-span">
                                <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">${title}</h2>
                            </div>
                            ${contentWithoutTitle.length > 0 ? `<div class="content text-gray-700 dark:text-gray-300 font-sans text-sm leading-relaxed">${contentWithoutTitle}</div>` : '<div class="content hidden"></div>'}
                        `;
                        container.appendChild(item);
                        return;
                    }

                    item.classList.add('bg-white', 'dark:bg-gray-800', 'shadow-sm', 'rounded-lg', 'overflow-hidden', 'border', 'border-gray-200', 'dark:border-gray-700', 'transition-all', 'duration-200');
                    
                    item.innerHTML = `
                        <button class="w-full text-left px-5 py-4 font-semibold text-gray-800 dark:text-gray-200 hover:bg-[#FFF3EB] dark:hover:bg-gray-700 flex justify-between items-center transition-colors focus:outline-none">
                            <span class="pr-4 leading-tight underline underline-offset-4 decoration-2 decoration-[#FF5000]/30 article-title-span">${title}</span>
                            <svg class="chevron w-5 h-5 text-[#FF5000] transform transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        <div class="content hidden px-5 py-4 border-t border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-sans text-sm bg-gray-50/50 dark:bg-gray-800/50">
                            ${contentHtml}
                        </div>
                    `;

                    const btn = item.querySelector('button');
                    const content = item.querySelector('.content');
                    const icon = item.querySelector('.chevron');

                    btn.addEventListener('click', () => {
                        const isHidden = content.classList.contains('hidden');
                        if (isHidden) {
                            content.classList.remove('hidden');
                            icon.classList.add('rotate-180');
                        } else {
                            content.classList.add('hidden');
                            icon.classList.remove('rotate-180');
                        }
                    });

                    container.appendChild(item);
                });
                
                if (foundCount === 0) {
                    container.innerHTML = `
                        <div class="text-center py-16 text-gray-500">
                            <svg class="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <p class="text-lg font-medium text-gray-600">No se han encontrado resultados</p>
                            <p class="text-sm mt-1">Prueba a buscar con otras palabras o términos.</p>
                        </div>
                    `;
                }
            }

            // --- Lógica del Modo Oscuro ---
            const themeToggleBtn = document.getElementById('theme-toggle');
            const darkIcon = document.getElementById('theme-toggle-dark-icon');
            const lightIcon = document.getElementById('theme-toggle-light-icon');

            if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
                lightIcon.classList.remove('hidden');
            } else {
                darkIcon.classList.remove('hidden');
            }

            themeToggleBtn.addEventListener('click', function() {
                darkIcon.classList.toggle('hidden');
                lightIcon.classList.toggle('hidden');

                if (localStorage.getItem('color-theme')) {
                    if (localStorage.getItem('color-theme') === 'light') {
                        document.documentElement.classList.add('dark');
                        localStorage.setItem('color-theme', 'dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                        localStorage.setItem('color-theme', 'light');
                    }
                } else {
                    if (document.documentElement.classList.contains('dark')) {
                        document.documentElement.classList.remove('dark');
                        localStorage.setItem('color-theme', 'light');
                    } else {
                        document.documentElement.classList.add('dark');
                        localStorage.setItem('color-theme', 'dark');
                    }
                }
            });

            // --- Lógica del Buscador en Móvil ---
            const openSearchBtn = document.getElementById('open-search-btn');
            const closeSearchBtn = document.getElementById('close-search-btn');
            const searchContainer = document.getElementById('search-container');
            const actionButtons = document.getElementById('action-buttons');
            const titleContainer = document.getElementById('header-title-container');

            openSearchBtn.addEventListener('click', () => {
                titleContainer.classList.add('hidden');
                actionButtons.classList.add('hidden');
                searchContainer.classList.remove('hidden');
                searchContainer.classList.add('flex');
                setTimeout(() => searchInput.focus(), 50);
            });

            closeSearchBtn.addEventListener('click', () => {
                searchContainer.classList.add('hidden');
                searchContainer.classList.remove('flex');
                titleContainer.classList.remove('hidden');
                actionButtons.classList.remove('hidden');
            });

            // --- Lógica del Tamaño de Letra ---
            const fontDecreaseBtn = document.getElementById('font-decrease-btn');
            const fontIncreaseBtn = document.getElementById('font-increase-btn');
            
            let currentFontSize = localStorage.getItem('font-size') ? parseInt(localStorage.getItem('font-size')) : 16;
            document.documentElement.style.fontSize = currentFontSize + 'px';

            function updateFontSize(change) {
                currentFontSize += change;
                if (currentFontSize < 12) currentFontSize = 12; // Límite inferior
                if (currentFontSize > 24) currentFontSize = 24; // Límite superior
                document.documentElement.style.fontSize = currentFontSize + 'px';
                localStorage.setItem('font-size', currentFontSize);
            }

            fontDecreaseBtn.addEventListener('click', () => updateFontSize(-1));
            fontIncreaseBtn.addEventListener('click', () => updateFontSize(1));

            renderArticles();

            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                if (isEditMode) return;
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    renderArticles(e.target.value.trim());
                }, 300);
            });

            // --- Lógica del Modo Editor ---
            const editBtn = document.getElementById('edit-mode-btn');
            const editIcon = document.getElementById('edit-icon');
            const saveIcon = document.getElementById('save-icon');
            const editText = document.getElementById('edit-mode-text');

            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    if (!isEditMode) {
                        isEditMode = true;
                        searchInput.disabled = true;
                        searchInput.placeholder = "Búsqueda deshabilitada en edición";
                        
                        editIcon.classList.add('hidden');
                        saveIcon.classList.remove('hidden');
                        editText.textContent = 'Guardar / Descargar';
                        editBtn.classList.remove('bg-blue-600/80');
                        editBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'animate-pulse');

                        if (searchInput.value.trim() !== '') {
                            searchInput.value = '';
                            renderArticles('');
                        }

                        document.querySelectorAll('.article-item').forEach(item => {
                            const title = item.querySelector('.article-title-span');
                            const content = item.querySelector('.content');
                            const icon = item.querySelector('.chevron');
                            
                            if (title) title.contentEditable = "true";
                            if (content) content.contentEditable = "true";
                            
                            if (title) title.classList.add('border-b-2', 'border-blue-300', 'outline-none', 'focus:bg-blue-50', 'dark:focus:bg-gray-700');
                            if (content) content.classList.add('border-2', 'border-blue-300', 'rounded-b-lg', 'outline-none', 'focus:bg-blue-50', 'dark:focus:bg-gray-700');
                            
                            if (content) content.classList.remove('hidden');
                            if (icon) icon.classList.add('rotate-180');
                        });
                        
                        alert('🛠️ MODO EDICIÓN ACTIVADO:\n\nPuedes hacer clic en cualquier texto y editarlo.\n- Usa Ctrl+B para Negritas.\n- Usa Ctrl+U para Subrayado.\n- Pulsa Enter para nuevos párrafos.\n\nCuando termines, pulsa "Guardar / Descargar" arriba a la derecha.');
                    } else {
                        isEditMode = false;
                        searchInput.disabled = false;
                        searchInput.placeholder = "Buscar...";
                        
                        editIcon.classList.remove('hidden');
                        saveIcon.classList.add('hidden');
                        editText.textContent = 'Editar Pacto';
                        editBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'animate-pulse');
                        editBtn.classList.add('bg-blue-600/80');

                        document.querySelectorAll('.article-item').forEach(item => {
                            const index = item.dataset.index;
                            const title = item.querySelector('.article-title-span');
                            const content = item.querySelector('.content');
                            
                            if (title) title.contentEditable = "false";
                            if (content) content.contentEditable = "false";
                            
                            if (title) title.classList.remove('border-b-2', 'border-blue-300', 'outline-none', 'focus:bg-blue-50', 'dark:focus:bg-gray-700');
                            if (content) content.classList.remove('border-2', 'border-blue-300', 'rounded-b-lg', 'outline-none', 'focus:bg-blue-50', 'dark:focus:bg-gray-700');
                            
                            let finalHtml = content ? content.innerHTML.replace(/<span class="bg-yellow-300 text-black font-bold px-1 rounded shadow-sm highlight">/g, '').replace(/<\/span>/g, '') : '';
                            parsedArticles[index].title = title ? title.innerText : parsedArticles[index].title;
                            parsedArticles[index].contentHtml = finalHtml;
                            
                            // Re-agregar título a la contentHtml de capitulos
                            if (parsedArticles[index].title.toUpperCase().startsWith('CAPITULO') && finalHtml !== '') {
                                parsedArticles[index].contentHtml = `<p class="articulo-titulo">${parsedArticles[index].title}</p>\n` + finalHtml;
                            }
                        });

                        descargarHTMLModificado();
                        renderArticles(searchInput.value.trim());
                    }
                });
            }

            function descargarHTMLModificado() {
                const htmlClone = document.documentElement.cloneNode(true);
                const cloneContainer = htmlClone.querySelector('#articles-container');
                if(cloneContainer) cloneContainer.innerHTML = '';
                
                const pactoDataScript = htmlClone.querySelector('#pacto-data');
                if (pactoDataScript) {
                    pactoDataScript.textContent = JSON.stringify(parsedArticles, null, 2);
                }

                const htmlString = "<!DOCTYPE html>\n" + htmlClone.outerHTML;
                const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'pactoMD_actualizado.html';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            }
        });
    
try {
    run();
    console.log('Success!');
} catch (e) {
    console.error('Error running script:', e);
}
