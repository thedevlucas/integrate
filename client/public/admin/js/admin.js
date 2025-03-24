document.addEventListener('DOMContentLoaded', () => {
    // Sidebar toggle functionality
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mobileSidebarToggle = document.querySelector('.mobile-sidebar-toggle');
    const adminLayout = document.querySelector('.admin-layout');

    sidebarToggle?.addEventListener('click', () => {
        adminLayout.classList.toggle('sidebar-collapsed');
    });

    mobileSidebarToggle?.addEventListener('click', () => {
        adminLayout.classList.toggle('sidebar-visible');
    });

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 992 && 
            adminLayout.classList.contains('sidebar-visible') && 
            !e.target.closest('.admin-sidebar') && 
            !e.target.closest('.mobile-sidebar-toggle')) {
            adminLayout.classList.remove('sidebar-visible');
        }
    });

    // Table row selection
    const selectAll = document.querySelector('.select-all');
    const selectRows = document.querySelectorAll('.select-row');

    selectAll?.addEventListener('change', (e) => {
        selectRows.forEach(row => {
            row.checked = e.target.checked;
        });
    });

    selectRows?.forEach(row => {
        row.addEventListener('change', () => {
            const allChecked = Array.from(selectRows).every(row => row.checked);
            const someChecked = Array.from(selectRows).some(row => row.checked);
            
            if (selectAll) {
                selectAll.checked = allChecked;
                selectAll.indeterminate = someChecked && !allChecked;
            }
        });
    });

    // Responsive tables
    const tables = document.querySelectorAll('.admin-table');
    tables.forEach(table => {
        const headerCells = table.querySelectorAll('th');
        const dataCells = table.querySelectorAll('td');

        headerCells.forEach((header, index) => {
            const label = header.textContent;
            dataCells.forEach((cell, i) => {
                if (i % headerCells.length === index) {
                    cell.setAttribute('data-label', label);
                }
            });
        });
    });
});