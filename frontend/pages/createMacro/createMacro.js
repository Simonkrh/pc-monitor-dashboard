const macroServerIP = `${CONFIG.MACRO_PC_IP}`;
let selectedPosition = null;

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
});

async function fetchMacros() {
  try {
    const response = await fetch(`http://${macroServerIP}/macros`);
    const config = await response.json();

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
      button.disabled = true;
    } else {
      // Allow selection
      button.classList.add('empty-macro');
      button.addEventListener('click', () => {
        selectedPosition = i;
        highlightSelectedPosition(i);
      });
    }

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
