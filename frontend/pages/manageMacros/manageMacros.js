const macroServerIP = `${CONFIG.MACRO_PC_IP}`;
let selectedPosition = null;
let moveFrom = null;
let moveTo = null;

const modeButtons = document.querySelectorAll('.mode-btn');
const allForms = document.querySelectorAll('#mode-forms form');

modeButtons.forEach(button => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    
    // Clear selections
    selectedPosition = null;
    highlightSelectedPosition(null); 
    moveFrom = null;
    moveTo = null;
    highlightMoveSelection();
    highlightDeleteSelection(null);
    updateMoveFormLabel();

    // Highlight selected button
    modeButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Show the correct form
    allForms.forEach(form => {
      form.style.display = form.dataset.mode === mode ? 'block' : 'none';
    });
  });
});


document.addEventListener('DOMContentLoaded', () => {
  fetchMacros()
  
  const form = document.getElementById('upload-form');
  const macroType = document.getElementById('macro-type');
  const macroValueInput = document.getElementById('macro-value');
  const macroValueLabel = document.getElementById('macro-value-label');
  const uploadStatus = document.getElementById('upload-status');

  // Change label depending on macro type
  macroType.addEventListener('change', () => {
    macroValueLabel.textContent = macroType.value === 'switch_account'
      ? 'Steam ID:' : 'Executable Path:';
    macroValueInput.placeholder = macroType.value === 'switch_account'
      ? 'e.g. 76561198197834043' : 'C:\\Path\\To\\App.exe';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const label = document.getElementById('macro-label').value.trim();
    const iconFile = document.getElementById('icon-upload').files[0];
    const macroTypeValue = macroType.value;
    const macroValue = macroValueInput.value.trim();

    if (!label || !iconFile || !macroValue) {
      uploadStatus.textContent = 'All fields are required.';
      return;
    }

    try {
      // Upload image file
      const formData = new FormData();
      formData.append('icon', iconFile);
      const uploadRes = await fetch(`http://${macroServerIP}/upload_macro_icon`, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error("Icon upload failed");
    }

    if (selectedPosition === null) {
        uploadStatus.textContent = 'Please select a position in the grid.';
        return;
    }

    const { icon_path } = await uploadRes.json();

      // Build macro object
      const macroCommand = macroTypeValue + ':' + macroValue;
      const macroData = {
        label,
        macro: macroCommand,
        icon: icon_path,
        position: selectedPosition
      };

      // Submit macro
      const res = await fetch(`http://${macroServerIP}/macros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(macroData)
      });

      if (res.ok) {
        uploadStatus.textContent = 'Macro added successfully!';
        form.reset();
        selectedPosition = null;
        highlightSelectedPosition(null); 
        fetchMacros(); 
      } else {
        uploadStatus.textContent = 'Failed to save macro.';
      }
    } catch (err) {
      console.error(err);
      uploadStatus.textContent = 'Error creating macro.';
    }
  });

  document.getElementById('move-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (moveFrom === null || moveTo === null) {
        document.getElementById('upload-status').textContent = 'Please select both positions.';
        return;
    }

    try {
        const response = await fetch(`http://${macroServerIP}/swap_macros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: moveFrom, to: moveTo })
        });

        if (response.ok) {
        document.getElementById('upload-status').textContent = 'Macros moved successfully.';
        moveFrom = null;
        moveTo = null;
        highlightMoveSelection();
        updateMoveFormLabel();
        fetchMacros();
        } else {
        document.getElementById('upload-status').textContent = 'Failed to move macros.';
        }
    } catch (err) {
        console.error(err);
        document.getElementById('upload-status').textContent = 'Error occurred while moving macros.';
    }
    });

    document.getElementById('delete-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectedPosition === null) {
            document.getElementById('upload-status').textContent = 'Please select a macro to delete.';
            return;
        }

        try {
            const res = await fetch(`http://${macroServerIP}/delete_macro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: selectedPosition })
            });

            if (res.ok) {
            document.getElementById('upload-status').textContent = 'Macro deleted successfully.';
            selectedPosition = null;
            highlightDeleteSelection(null);
            fetchMacros();
            } else {
            const err = await res.json();
            document.getElementById('upload-status').textContent = err.error || 'Failed to delete macro.';
            }
        } catch (err) {
            console.error(err);
            document.getElementById('upload-status').textContent = 'Error deleting macro.';
        }
    });

    document.getElementById('resize-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uploadStatus = document.getElementById('upload-status');

    const columns = parseInt(document.getElementById('resize-columns').value, 10);
    const rows = parseInt(document.getElementById('resize-rows').value, 10);

    if (isNaN(columns) || isNaN(rows) || columns < 1 || rows < 1) {
      uploadStatus.textContent = 'Grid size must be at least 1x1.';
      return;
    }

    try {
      // Fetch current macros to validate against new size
      const response = await fetch(`http://${macroServerIP}/macros`);
      const data = await response.json();

      const maxSlots = columns * rows;
      const tooManyMacros = data.macros.some(m => m.position >= maxSlots);

      if (tooManyMacros) {
        uploadStatus.textContent = `Resize would remove some macros. Move or delete them first.`;
        return;
      }

      // Submit new grid size
      const res = await fetch(`http://${macroServerIP}/resize_grid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns, rows })
      });

      if (res.ok) {
        uploadStatus.textContent = 'Grid resized successfully.';
        fetchMacros();
      } else {
        uploadStatus.textContent = 'Failed to resize grid.';
      }
    } catch (err) {
      console.error(err);
      uploadStatus.textContent = 'Error resizing grid.';
    }
  });

  document.getElementById('resize-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uploadStatus = document.getElementById('upload-status');

    const columns = parseInt(document.getElementById('resize-columns').value, 10);
    const rows = parseInt(document.getElementById('resize-rows').value, 10);

    if (isNaN(columns) || isNaN(rows) || columns < 1 || rows < 1) {
      uploadStatus.textContent = 'Grid size must be at least 1x1.';
      return;
    }

    try {
      // Fetch current macros to validate against new size
      const response = await fetch(`http://${macroServerIP}/macros`);
      const data = await response.json();

      const maxSlots = columns * rows;
      const tooManyMacros = data.macros.some(m => m.position >= maxSlots);

      if (tooManyMacros) {
        uploadStatus.textContent = `Resize would remove some macros. Move or delete them first.`;
        return;
      }

      // Submit new grid size
      const res = await fetch(`http://${macroServerIP}/resize_grid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns, rows })
      });

      if (res.ok) {
        uploadStatus.textContent = 'Grid resized successfully.';
        fetchMacros();
      } else {
        uploadStatus.textContent = 'Failed to resize grid.';
      }
    } catch (err) {
      console.error(err);
      uploadStatus.textContent = 'Error resizing grid.';
    }
  });
});

async function fetchMacros() {
  try {
    const response = await fetch(`http://${macroServerIP}/macros`);
    const config = await response.json();

    document.getElementById('resize-columns').value = config.grid.columns;
    document.getElementById('resize-rows').value = config.grid.rows;

    renderMacroGrid(config.grid, config.macros);
  } catch (err) {
    console.error("Failed to fetch dashboard config:", err);
  }
}


function renderMacroGrid(grid, macros) {
  const container = document.getElementById('macro-grid-container');
  container.style.gridTemplateColumns = `repeat(${grid.columns}, 1fr)`;
  container.innerHTML = ''; 

  const totalSlots = grid.columns * grid.rows;

  const macroMap = {};
  macros.forEach(m => {
    if (typeof m.position === 'number') {
      macroMap[m.position] = m;
    }
  });

  for (let i = 0; i < totalSlots; i++) {
    const button = document.createElement('button');
    button.className = 'macro-btn';
    button.dataset.position = i;

    if (macroMap[i]) {
        const macro = macroMap[i];
        const img = document.createElement('img');
        img.src = `http://${macroServerIP}${macro.icon}`;
        img.className = 'macro-icon';
        img.onerror = () => { img.style.display = 'none'; };
        button.appendChild(img);
        // Don't disable! Just style and handle in JS logic
        button.classList.add('filled-macro');
    } else {
        button.classList.add('empty-macro');
    }


    button.addEventListener('click', () => {
    const activeMode = document.querySelector('.mode-btn.active')?.dataset.mode;

    if (activeMode === 'create') {
        if (!macroMap[i]) {
        selectedPosition = i;
        highlightSelectedPosition(i);
        }
    }
    
    if (activeMode === 'move') {
        if (moveFrom === null) {
        moveFrom = i;
        } else if (moveTo === null && i !== moveFrom) {
        moveTo = i;
        } else {
        moveFrom = i;
        moveTo = null;
        }
        highlightMoveSelection();
        updateMoveFormLabel();
    }

    if (activeMode === 'delete') {
        if (macroMap[i]) {
            selectedPosition = i;
            highlightDeleteSelection(i);
        }
    }

    });

    container.appendChild(button);

  }
}

function highlightSelectedPosition(position) {
  document.querySelectorAll('.empty-macro').forEach(btn => {
    btn.classList.remove('selected-macro');
    if (position !== null && parseInt(btn.dataset.position) === position) {
      btn.classList.add('selected-macro');
    }
  });

  const label = document.getElementById('selected-position-label');
  label.textContent = position !== null
    ? `Selected Position: ${position}`
    : `Selected Position: None`;
}

function highlightMoveSelection() {
  document.querySelectorAll('.macro-btn').forEach(btn => {
    const pos = parseInt(btn.dataset.position);
    btn.classList.remove('selected-from', 'selected-to');

    if (pos === moveFrom) btn.classList.add('selected-from');
    if (pos === moveTo) btn.classList.add('selected-to');
  });
}

function highlightDeleteSelection(position) {
  document.querySelectorAll('.macro-btn').forEach(btn => {
    btn.classList.remove('selected-delete');
    if (parseInt(btn.dataset.position) === position) {
      btn.classList.add('selected-delete');
    }
  });
}

function updateMoveFormLabel() {
  const label = document.getElementById('move-position-label');
  label.textContent = `From: ${moveFrom !== null ? moveFrom : 'None'} → To: ${moveTo !== null ? moveTo : 'None'}`;
}
