document.addEventListener('DOMContentLoaded', () => {
    // pactoData is loaded from data/pacto.js in a script tag above
    
    // Dividir el texto grande en artículos y capítulos o leer JSON
    let parsedArticles = [];
    
    if (pactoData.trim().startsWith('[')) {
        try {
            parsedArticles = JSON.parse(pactoData);
        } catch(e) {
            console.error("Error parsing JSON data", e);
        }
    } else {
        const chunkRegex = /(?=\n(?:CAPITULO|Artículo|Articulo)\s+)/i;
        parsedArticles = pactoData.split(chunkRegex).map(chunk => {
            let text = chunk.replace(/\[Page \d+\]/g, '').replace(/\n\d+\n/g, '\n').trim();
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
        // (?![^<]*>) evita reemplazar dentro de etiquetas HTML.
        // Los corchetes simulan un límite de palabra (\b) pero compatible con acentos españoles.
        return new RegExp(`(?![^<]*>)(^|[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑüÜ])(${pattern})(?=[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑüÜ]|$)`, 'gi');
    }

    function formatParagraphs(text) {
        const lines = text.split('\n');
        let formatted = [];
        let currentParagraph = [];
        let currentStyle = 'parrafo-normal';

        function pushCurrent() {
            if (currentParagraph.length > 0) {
                formatted.push(`<p class="${currentStyle}">${currentParagraph.join(' ')}</p>`);
                currentParagraph = [];
                currentStyle = 'parrafo-normal';
            }
        }

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === '') continue;
            
            const isNumberList = /^\d+\./.test(line); // Ej: 1., 2.
            const isLetterList = /^[a-z]\)/.test(line); // Ej: a), b)
            const isBulletList = /^[-•*o]\s/.test(line); // Ej: - o •
            
            const isListItem = isNumberList || isLetterList || isBulletList;
            const prevLine = currentParagraph.length > 0 ? currentParagraph[currentParagraph.length - 1] : '';
            const prevEndsWithPunctuation = /[.:;]$/.test(prevLine.trim().replace(/\[\[ENDHIGHLIGHT\]\]/g, ''));
            const isHeader = /^(?:CAPITULO|Artículo|Articulo)/i.test(line);
            const isIndexLine = /\|.+\|.+\|/.test(line);
            
            if (currentParagraph.length === 0 || prevEndsWithPunctuation || isListItem || isHeader || isIndexLine) {
                pushCurrent();
                currentParagraph = [line];
                
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
                currentParagraph.push(line);
            }
        }
        pushCurrent();
        
        return formatted.join('');
    }

    function renderArticles(filter = '') {
        // En modo edición no repintamos para no perder foco
        if (isEditMode) return;

        container.innerHTML = '';
        const stopWords = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del',
            'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'de', 'desde', 'en', 'entre', 
            'hacia', 'hasta', 'para', 'por', 'segun', 'sin', 'so', 'sobre', 'tras',
            'y', 'e', 'o', 'u', 'ni', 'que', 'pero', 'si', 'como', 'su', 'sus'
        ]);
        const keywords = removeAccents(filter).toLowerCase().split(/\s+/)
            .filter(w => w.length > 1 && !stopWords.has(w));
        
        let searchRegex = null;
        if (keywords.length > 0) {
            const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Permite hasta 3 palabras intermedias entre las palabras clave buscadas
            const gapPattern = '(?:[^a-z0-9]+[a-z0-9]+){0,3}[^a-z0-9]+';
            searchRegex = new RegExp(keywords.map(escapeRegExp).join(gapPattern), 'i');
        }

        let foundCount = 0;

        parsedArticles.forEach((article, index) => {
            // Buscamos sin etiquetas HTML
            const plainText = article.title + " " + article.contentHtml.replace(/<[^>]*>?/gm, '');
            const articleTextNormalized = removeAccents(plainText).toLowerCase();
            
            // Check if keywords match the ordered pattern with proximity
            const isMatch = !searchRegex || searchRegex.test(articleTextNormalized);
            if (!isMatch) return;

            foundCount++;
            let contentHtml = article.contentHtml;
            const title = article.title;

            // Resaltar la búsqueda con marcadores temporales
            if (keywords.length > 0) {
                keywords.forEach(kw => {
                    const regex = createAccentInsensitiveRegex(kw);
                    // Reemplazamos respetando el caracter previo ($1) y envolviendo la palabra ($2)
                    contentHtml = contentHtml.replace(regex, '$1[[HIGHLIGHT]]$2[[ENDHIGHLIGHT]]');
                });
            }

            // Reemplazar marcadores temporales por HTML
            contentHtml = contentHtml.replace(/\[\[HIGHLIGHT\]\]/g, '<span class="highlight">').replace(/\[\[ENDHIGHLIGHT\]\]/g, '</span>');

            const item = document.createElement('div');
            item.className = 'article-item bg-white shadow-sm rounded-lg overflow-hidden border border-gray-300 transition-all duration-200';
            item.dataset.index = index;
            
            item.innerHTML = `
                <button class="w-full text-left px-5 py-4 font-semibold text-gray-800 hover:bg-[#FFF3EB] flex justify-between items-center transition-colors focus:outline-none">
                    <span class="pr-4 leading-tight article-title-span">${title}</span>
                    <svg class="chevron w-5 h-5 text-[#FF5000] transform transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                <div class="content hidden px-5 py-4 border-t border-gray-200 text-gray-700 font-sans text-sm bg-gray-50/50">
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

    renderArticles();

    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (isEditMode) return;
            searchInput.value = '';
            renderArticles('');
            searchInput.focus();
        });
    }

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

    editBtn.addEventListener('click', () => {
        if (!isEditMode) {
            // ENTRAR A MODO EDICIÓN
            isEditMode = true;
            searchInput.disabled = true;
            searchInput.placeholder = "Búsqueda deshabilitada en edición";
            
            editIcon.classList.add('hidden');
            saveIcon.classList.remove('hidden');
            editText.textContent = 'Guardar / Descargar';
            editBtn.classList.remove('bg-blue-600/80');
            editBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'animate-pulse');

            // Asegurarnos de que todo está renderizado sin filtro
            if (searchInput.value.trim() !== '') {
                searchInput.value = '';
                renderArticles('');
            }

            // Hacer editables y abrir todos
            document.querySelectorAll('.article-item').forEach(item => {
                const title = item.querySelector('.article-title-span');
                const content = item.querySelector('.content');
                const icon = item.querySelector('.chevron');
                
                title.contentEditable = "true";
                content.contentEditable = "true";
                
                title.classList.add('border-b-2', 'border-blue-300', 'outline-none', 'focus:bg-blue-50');
                content.classList.add('border-2', 'border-blue-300', 'rounded-b-lg', 'outline-none', 'focus:bg-blue-50');
                
                content.classList.remove('hidden');
                icon.classList.add('rotate-180');
            });
            
            alert('🛠️ MODO EDICIÓN ACTIVADO:\n\nPuedes hacer clic en cualquier texto y editarlo.\n- Usa Ctrl+B para Negritas.\n- Usa Ctrl+U para Subrayado.\n- Pulsa Enter para nuevos párrafos.\n\nCuando termines, pulsa "Guardar / Descargar" arriba a la derecha.');
            
        } else {
            // GUARDAR Y SALIR DE MODO EDICIÓN
            isEditMode = false;
            searchInput.disabled = false;
            searchInput.placeholder = "Buscar...";
            
            editIcon.classList.remove('hidden');
            saveIcon.classList.add('hidden');
            editText.textContent = 'Editar Pacto';
            editBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'animate-pulse');
            editBtn.classList.add('bg-blue-600/80');

            // Recolectar cambios
            document.querySelectorAll('.article-item').forEach(item => {
                const index = item.dataset.index;
                const title = item.querySelector('.article-title-span');
                const content = item.querySelector('.content');
                
                title.contentEditable = "false";
                content.contentEditable = "false";
                
                title.classList.remove('border-b-2', 'border-blue-300', 'outline-none', 'focus:bg-blue-50');
                content.classList.remove('border-2', 'border-blue-300', 'rounded-b-lg', 'outline-none', 'focus:bg-blue-50');
                
                // Actualizar array de datos limpiando los highlights si los hubiera
                let finalHtml = content.innerHTML.replace(/<span class="highlight">/g, '').replace(/<\/span>/g, '');
                parsedArticles[index].title = title.innerText;
                parsedArticles[index].contentHtml = finalHtml;
            });

            // Descargar archivo modificado
            descargarHTMLModificado();
            
            // Re-render normal
            renderArticles(searchInput.value.trim());
        }
    });

    function descargarHTMLModificado() {
        // Clonar el DOM actual para no afectar a la vista actual
        const htmlClone = document.documentElement.cloneNode(true);
        
        // 1. Limpiar el contenedor de articulos (app.js los reconstruye al cargar)
        const cloneContainer = htmlClone.querySelector('#articles-container');
        if(cloneContainer) cloneContainer.innerHTML = '';
        
        // 2. Insertar los datos JSON en el script pacto-data
        const pactoDataScript = htmlClone.querySelector('#pacto-data');
        if (pactoDataScript) {
            // Guardamos el JSON de forma bonita
            pactoDataScript.textContent = JSON.stringify(parsedArticles, null, 2);
        }

        // Crear el archivo HTML completo
        const htmlString = "<!DOCTYPE html>\n" + htmlClone.outerHTML;
        
        // Crear un Blob y forzar la descarga
        const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pactoMD_actualizado.html';
        document.body.appendChild(a);
        a.click();
        
        // Limpieza
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
});
