const macroServerIP = `${CONFIG.MACRO_PC_IP}`;
let selectedPosition = null;
let moveFrom = null;
let moveTo = null;

let jsonEditor;
let uploadStatus;

async function loadJsonEditor() {
    uploadStatus.textContent = "Loading macros.json...";
    const res = await fetch(`http://${macroServerIP}/macros`);
    if (!res.ok) {
      uploadStatus.textContent = "Failed to load macros.json";
      return;
    }
    const data = await res.json();
    jsonEditor.value = JSON.stringify(data, null, 2);
    uploadStatus.textContent = "Loaded macros.json";
  }

  function validateConfigClient(cfg) {
    if (!cfg || typeof cfg !== "object") return "Root must be an object";
    if (!cfg.grid || typeof cfg.grid !== "object") return "Missing grid";
    if (!Number.isInteger(cfg.grid.columns) || cfg.grid.columns < 1) return "grid.columns must be an int >= 1";
    if (!Number.isInteger(cfg.grid.rows) || cfg.grid.rows < 1) return "grid.rows must be an int >= 1";
    if (!Array.isArray(cfg.macros)) return "macros must be an array";

    const maxSlots = cfg.grid.columns * cfg.grid.rows;
    const seen = new Set();

    for (const m of cfg.macros) {
      if (!m || typeof m !== "object") return "Each macro must be an object";
      if (typeof m.label !== "string") return "macro.label must be a string";
      if (typeof m.macro !== "string") return "macro.macro must be a string";
      if (typeof m.icon !== "string") return "macro.icon must be a string";
      if (!Number.isInteger(m.position)) return "macro.position must be an integer";
      if (m.position < 0 || m.position >= maxSlots) return `macro.position ${m.position} out of bounds (0..${maxSlots - 1})`;
      if (seen.has(m.position)) return `Duplicate macro position: ${m.position}`;
      seen.add(m.position);
    }
    return null;
  }

document.addEventListener('DOMContentLoaded', () => {
  uploadStatus = document.getElementById('upload-status');
  jsonEditor = document.getElementById('macros-json-editor');
  const returnButton = document.getElementById('return-button');

  if (returnButton) {
    returnButton.addEventListener('click', () => {
      window.location.href = "/settings";
    });
  }

  const modeButtons = document.querySelectorAll('.mode-btn');
  const allForms = document.querySelectorAll('#mode-forms form');

  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      
      if (mode === "json") loadJsonEditor();
      
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

  fetchMacros()
  
  const form = document.getElementById('upload-form');
  const macroType = document.getElementById('macro-type');
  const macroValueInput = document.getElementById('macro-value');
  const macroValueLabel = document.getElementById('macro-value-label');
  const macroLaunchParamsInput = document.getElementById('macro-launch-params');
  const macroLaunchParamsLabel = document.getElementById('macro-launch-params-label');
  const macroLaunchParamsHelp = document.getElementById('macro-launch-params-help');

  const jsonReloadBtn = document.getElementById('json-reload-btn');
  const jsonFormatBtn = document.getElementById('json-format-btn');
  const jsonSaveBtn = document.getElementById('json-save-btn');

  const help = document.getElementById('macro-value-help');

  function setLaunchParamsVisible(visible) {
    const display = visible ? '' : 'none';
    macroLaunchParamsInput.style.display = display;
    macroLaunchParamsLabel.style.display = display;
    macroLaunchParamsHelp.style.display = display;

    if (!visible) macroLaunchParamsInput.value = '';
  }

  function updateMacroTypeUI() {
    if (macroType.value === 'switch_account') {
      macroValueLabel.textContent = 'Steam ID:';
      macroValueInput.placeholder = 'e.g. 76561198197834043';
      help.style.display = 'none';
      help.innerHTML = '';
      setLaunchParamsVisible(false);
      return;
    }

    if (macroType.value === 'type_text') {
      macroValueLabel.textContent = 'Text to type:';
      macroValueInput.placeholder = 'e.g. Hello, World!';

      help.style.display = 'block';
      help.innerHTML = `
        (Use <code>&lt;enter&gt;</code> to press Enter, and <code>&lt;wait:2000&gt;</code> to wait 2 seconds.
        Example: <code>hello&lt;enter&gt;&lt;wait:2000&gt;world</code>)
      `;
      setLaunchParamsVisible(false);
      return;
    }

    macroValueLabel.textContent = 'Executable Path:';
    macroValueInput.placeholder = 'C:\\Path\\To\\App.exe';
    help.style.display = 'none';
    help.innerHTML = '';

    setLaunchParamsVisible(macroType.value === 'open_app');
  }

  // Change label depending on macro type
  macroType.addEventListener('change', () => {
    updateMacroTypeUI();
  });

  updateMacroTypeUI();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const label = document.getElementById('macro-label').value.trim();
    const iconFile = document.getElementById('icon-upload').files[0];
    const macroTypeValue = macroType.value;
    let macroValue = macroValueInput.value;
    if (macroTypeValue !== "type_text") macroValue = macroValue.trim();
    const launchParams = (macroLaunchParamsInput?.value ?? "").trim();

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
      let macroCommand = macroTypeValue + ':' + macroValue;

      if (macroTypeValue === "open_app" && launchParams) {
        macroCommand = `open_app:${JSON.stringify({ app_path: macroValue, launch_params: launchParams })}`;
      }
      
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
        updateMacroTypeUI();
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

  jsonReloadBtn.addEventListener('click', loadJsonEditor);

  jsonFormatBtn.addEventListener('click', () => {
    try {
      const obj = JSON.parse(jsonEditor.value);
      jsonEditor.value = JSON.stringify(obj, null, 2);
      uploadStatus.textContent = "Formatted JSON";
    } catch {
      uploadStatus.textContent = "Invalid JSON (can’t format)";
    }
  });

  jsonSaveBtn.addEventListener('click', async () => {
    let cfg;
    try {
      cfg = JSON.parse(jsonEditor.value);
    } catch {
      uploadStatus.textContent = "Invalid JSON (fix before saving)";
      return;
    }

    const err = validateConfigClient(cfg);
    if (err) {
      uploadStatus.textContent = `Config invalid: ${err}`;
      return;
    }

    uploadStatus.textContent = "Saving...";
    const res = await fetch(`http://${macroServerIP}/macros_raw`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg)
    });

    if (!res.ok) {
      const msg = await res.text();
      uploadStatus.textContent = `Save failed: ${msg}`;
      return;
    }

    uploadStatus.textContent = "Saved macros.json";
    fetchMacros(); // refresh grid view
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
  label.textContent = `From: ${moveFrom !== null ? moveFrom : 'None'} -> To: ${moveTo !== null ? moveTo : 'None'}`;
}
