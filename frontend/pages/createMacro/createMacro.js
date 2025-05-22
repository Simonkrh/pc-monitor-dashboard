document.addEventListener('DOMContentLoaded', () => {
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
      const uploadRes = await fetch(`http://${CONFIG.MACRO_PC_IP}/upload_macro_icon`, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error("Icon upload failed");
    }

    const { icon_path } = await uploadRes.json();

      // Build macro object
      const macroCommand = macroTypeValue + ':' + macroValue;
      const macroData = {
        label,
        macro: macroCommand,
        icon: icon_path
      };

      // Submit macro
      const res = await fetch(`http://${CONFIG.MACRO_PC_IP}/macros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(macroData)
      });

      if (res.ok) {
        uploadStatus.textContent = 'Macro added successfully!';
        form.reset();
      } else {
        uploadStatus.textContent = 'Failed to save macro.';
      }
    } catch (err) {
      console.error(err);
      uploadStatus.textContent = 'Error creating macro.';
    }
  });
});
