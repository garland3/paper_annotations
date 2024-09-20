import { validateApiKey, sendQuestion, generateEmbeddings } from './api.js';

let currentSelection = null;
let annotations = [];
let apiKey = '';
let apiUrl = 'https://api.openai.com/v1';
let modelName = 'gpt-4o-mini';
let paperContent;
let annotationForm;
let annotationText;

document.addEventListener('DOMContentLoaded', function() {
    paperContent = document.getElementById('paperContent');
    annotationForm = document.getElementById('annotationForm');
    annotationText = document.getElementById('annotationText');

    loadConfig();
    
    // Load annotations from server
    fetch(`/annotations/${paperName}`)
        .then(response => response.json())
        .then(data => {
            annotations = data;
            // Delay loading annotations to ensure page is fully rendered
            setTimeout(loadAnnotations, 500);
        })
        .catch(error => console.error("Error loading annotations from server:", error));

    // Set up event listeners
    paperContent.addEventListener('mouseup', showAnnotationForm);
    document.getElementById('clearAnnotations').addEventListener('click', clearAnnotations);
    document.getElementById('saveAnnotationBtn').addEventListener('click', function() {
        if (this.dataset.action === 'update') {
            updateAnnotation(parseInt(this.dataset.id));
        } else {
            saveAnnotation();
        }
    });
    document.getElementById('askAIBtn').addEventListener('click', window.askAI);
    document.getElementById('cancelAnnotationBtn').addEventListener('click', cancelAnnotation);
    document.getElementById('saveConfig').addEventListener('click', saveConfig);
    document.getElementById('downloadAnnotations').addEventListener('click', downloadAnnotations);
    document.getElementById('loadAnnotationsButton').addEventListener('click', function() {
        document.getElementById('loadAnnotations').click();
    });
    document.getElementById('loadAnnotations').addEventListener('change', loadAnnotationsFromFile);
});

// Load configuration from localStorage
function loadConfig() {
    apiKey = localStorage.getItem('apiKey') || '';
    apiUrl = localStorage.getItem('apiUrl') || 'https://api.openai.com/v1';
    modelName = localStorage.getItem('modelName') || 'gpt-4o-mini';
    document.getElementById('apiKey').value = apiKey;
    document.getElementById('apiUrl').value = apiUrl;
    document.getElementById('modelName').value = modelName;
}

// Save configuration to localStorage
function saveConfig() {
    apiKey = document.getElementById('apiKey').value;
    apiUrl = document.getElementById('apiUrl').value;
    modelName = document.getElementById('modelName').value;
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('modelName', modelName);
    alert('Configuration saved!');
}

function loadAnnotations() {
    console.log("Loading annotations");
    const savedAnnotations = localStorage.getItem(`annotations_${paperName}`);
    if (savedAnnotations) {
        annotations = JSON.parse(savedAnnotations);
        console.log("Loaded annotations from localStorage:", annotations);
    }
    
    // Sort annotations by start position
    annotations.sort((a, b) => a.start - b.start);
    
    // Clear existing annotations
    clearExistingAnnotations();
    
    // Apply annotations
    annotations.forEach(annotation => {
        try {
            highlightText(annotation);
            displayAnnotation(annotation);
        } catch (error) {
            console.error("Error loading annotation:", error);
        }
    });
}

function saveAnnotationsToServer() {
    fetch(`/annotations/${paperName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
        },
        body: JSON.stringify(annotations),
    })
    .then(response => response.json())
    .then(data => console.log('Success:', data))
    .catch((error) => console.error('Error:', error));
}

function showAnnotationForm() {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(paperContent);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;

        currentSelection = {
            text: selection.toString(),
            start: start,
            end: start + selection.toString().length,
            range: range.cloneRange() // Store the range for later use
        };
        
        // Highlight the selected text temporarily
        highlightRange(range, 'temp-highlight');
        
        // Show the annotation form
        annotationForm.style.display = 'block';
        
        // Move the cursor to the text box
        annotationText.focus();

        // Add event listener for Ctrl+Enter
        annotationText.addEventListener('keydown', handleCtrlEnter);
    }
}

function handleCtrlEnter(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        const saveButton = document.querySelector('#annotationForm .btn-primary');
        saveButton.click(); // This will trigger the click event on the save button
    }
}

function highlightRange(range, className) {
    const tempSpan = document.createElement('span');
    tempSpan.className = className;
    try {
        range.surroundContents(tempSpan);
    } catch (e) {
        console.error("Failed to surround contents, falling back to insertNode", e);
        tempSpan.appendChild(range.extractContents());
        range.insertNode(tempSpan);
    }
}

function saveAnnotation() {
    const annotationTextValue = annotationText.value;
    if (annotationTextValue && currentSelection) {
        const annotation = {
            id: Date.now(),
            text: currentSelection.text,
            note: annotationTextValue,
            start: currentSelection.start,
            end: currentSelection.end
        };
        
        // Sort annotations by start position before inserting
        const insertIndex = annotations.findIndex(a => a.start > annotation.start);
        if (insertIndex === -1) {
            annotations.push(annotation);
        } else {
            annotations.splice(insertIndex, 0, annotation);
        }
        
        localStorage.setItem(`annotations_${paperName}`, JSON.stringify(annotations));
        
        // Remove temporary highlight and add permanent one
        const tempHighlight = paperContent.querySelector('.temp-highlight');
        if (tempHighlight) {
            const parent = tempHighlight.parentNode;
            const permanentHighlight = document.createElement('span');
            permanentHighlight.className = 'highlight';
            permanentHighlight.id = `highlight-${annotation.id}`;
            permanentHighlight.innerHTML = tempHighlight.innerHTML;
            parent.replaceChild(permanentHighlight, tempHighlight);
        }
        
        displayAnnotation(annotation);
        cancelAnnotation();
        saveAnnotationsToServer();
    }
}

function cancelAnnotation() {
    annotationForm.style.display = 'none';
    annotationText.value = '';
    
    // Remove temporary highlight if cancelling
    const tempHighlight = paperContent.querySelector('.temp-highlight');
    if (tempHighlight) {
        const parent = tempHighlight.parentNode;
        while (tempHighlight.firstChild) {
            parent.insertBefore(tempHighlight.firstChild, tempHighlight);
        }
        parent.removeChild(tempHighlight);
    }
    
    // Remove the Ctrl+Enter event listener
    annotationText.removeEventListener('keydown', handleCtrlEnter);
    
    // Reset the save button's data attributes
    const saveButton = document.querySelector('#annotationForm .btn-primary');
    saveButton.dataset.action = 'save';
    delete saveButton.dataset.id;
    
    currentSelection = null;
}

// Modify the askAI function to be globally accessible
window.askAI = async function() {
    if (!apiKey || !apiUrl || !modelName) {
        alert('Please set the API configuration first.');
        return;
    }
    
    if (!currentSelection) {
        alert('Please select some text first.');
        return;
    }

    const question = prompt("What would you like to ask about this highlighted text?");
    if (!question) return;

    try {
        // Get the full content of the paper
        const fullContent = paperContent.innerText;

        // Calculate the start and end indices for the context
        const contextStart = Math.max(0, currentSelection.start - 500);
        const contextEnd = Math.min(fullContent.length, currentSelection.end + 500);

        // Extract the context
        const context = fullContent.substring(contextStart, contextEnd);

        // Formulate the prompt
        const prompt = `<context>${context}</context>
<instructions>The user highlighted "${currentSelection.text}" and asked "${question}".
Please answer the user's question</instructions>`;

        const response = await sendQuestion(apiKey, prompt, "");
        
        // Use the AI response as the annotation
        annotationText.value = response.answer;
        
        // Save the annotation
        saveAnnotation();
    } catch (error) {
        console.error('Error asking AI:', error);
        alert('An error occurred while asking the AI. Please try again.');
    }
};

// Make other necessary functions globally accessible
window.saveAnnotation = saveAnnotation;
window.cancelAnnotation = cancelAnnotation;
window.editAnnotation = editAnnotation;
window.deleteAnnotation = deleteAnnotation;

function highlightText(annotation) {
    const range = new Range();
    const startNode = findTextNode(paperContent, annotation.start);
    const endNode = findTextNode(paperContent, annotation.end);
    
    if (startNode && endNode) {
        range.setStart(startNode.node, startNode.offset);
        range.setEnd(endNode.node, endNode.offset);
        
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'highlight';
        highlightSpan.id = `highlight-${annotation.id}`;
        
        range.surroundContents(highlightSpan);
    }
}

function findTextNode(node, targetOffset) {
    if (node.nodeType === Node.TEXT_NODE) {
        if (targetOffset <= node.length) {
            return { node: node, offset: targetOffset };
        } else {
            return { node: node, offset: node.length };
        }
    }
    
    let currentOffset = 0;
    for (let child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            if (currentOffset + child.length >= targetOffset) {
                return { node: child, offset: targetOffset - currentOffset };
            }
            currentOffset += child.length;
        } else {
            const result = findTextNode(child, targetOffset - currentOffset);
            if (result) {
                return result;
            }
            currentOffset += child.textContent.length;
        }
    }
    
    return null;
}

function displayAnnotation(annotation) {
    const highlightElement = document.getElementById(`highlight-${annotation.id}`);
    if (highlightElement) {
        const annotationBubble = document.createElement('div');
        annotationBubble.className = 'annotation-bubble';
        annotationBubble.id = `annotation-${annotation.id}`;
        annotationBubble.innerHTML = `
            <p><strong>Note:</strong> ${annotation.note}</p>
            <div class="annotation-buttons">
                <button onclick="editAnnotation(${annotation.id})" class="btn btn-secondary">Edit</button>
                <button onclick="deleteAnnotation(${annotation.id})" class="btn btn-danger">Delete</button>
            </div>
        `;
        highlightElement.insertAdjacentElement('afterend', annotationBubble);
    }
}

function deleteAnnotation(id) {
    annotations = annotations.filter(a => a.id !== id);
    localStorage.setItem(`annotations_${paperName}`, JSON.stringify(annotations));
    const highlightElement = document.getElementById(`highlight-${id}`);
    const annotationElement = document.getElementById(`annotation-${id}`);
    if (highlightElement) {
        const parent = highlightElement.parentNode;
        while (highlightElement.firstChild) {
            parent.insertBefore(highlightElement.firstChild, highlightElement);
        }
        parent.removeChild(highlightElement);
    }
    if (annotationElement) {
        annotationElement.remove();
    }
    saveAnnotationsToServer();
}

function clearAnnotations() {
    // Clear annotations from localStorage
    localStorage.removeItem(`annotations_${paperName}`);
    
    // Clear annotations array
    annotations = [];
    
    // Remove all highlight spans from the paper content
    const highlights = paperContent.querySelectorAll('.highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        while (highlight.firstChild) {
            parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
    });
    
    // Clear the annotations panel
    const annotationBubbles = paperContent.querySelectorAll('.annotation-bubble');
    annotationBubbles.forEach(bubble => bubble.remove());
    
    saveAnnotationsToServer();
}

// Download annotations
document.getElementById('downloadAnnotations').addEventListener('click', function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(annotations));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", paperName + "_annotations.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

// Load annotations
document.getElementById('loadAnnotationsButton').addEventListener('click', function() {
    document.getElementById('loadAnnotations').click();
});

document.getElementById('loadAnnotations').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            try {
                annotations = JSON.parse(content);
                clearExistingAnnotations();
                loadAnnotations();
                saveAnnotationsToServer();
            } catch (error) {
                console.error("Error parsing JSON:", error);
            }
        };
        reader.readAsText(file);
    }
});

function clearExistingAnnotations() {
    const highlights = paperContent.querySelectorAll('.highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        while (highlight.firstChild) {
            parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
    });
    const annotationBubbles = paperContent.querySelectorAll('.annotation-bubble');
    annotationBubbles.forEach(bubble => bubble.remove());
    document.getElementById('clearAnnotations').addEventListener('click', clearAnnotations);
}

function editAnnotation(id) {
    const annotation = annotations.find(a => a.id === id);
    if (annotation) {
        currentSelection = {
            text: annotation.text,
            start: annotation.start,
            end: annotation.end
        };
        annotationText.value = annotation.note;
        annotationForm.style.display = 'block';
        annotationText.focus();
        annotationText.addEventListener('keydown', handleCtrlEnter);
        
        // Set data attributes for the save button
        const saveButton = document.querySelector('#annotationForm .btn-primary');
        saveButton.dataset.action = 'update';
        saveButton.dataset.id = id;
    }
}

function updateAnnotation(id) {
    const annotationTextValue = annotationText.value;
    if (annotationTextValue && currentSelection) {
        const index = annotations.findIndex(a => a.id === id);
        if (index !== -1) {
            annotations[index].note = annotationTextValue;
            localStorage.setItem(`annotations_${paperName}`, JSON.stringify(annotations));
            saveAnnotationsToServer();
            
            // Update the displayed annotation
            const annotationElement = document.getElementById(`annotation-${id}`);
            if (annotationElement) {
                annotationElement.querySelector('p').innerHTML = `<strong>Note:</strong> ${annotationTextValue}`;
            }
            
            cancelAnnotation();
        }
    }
}