        // Bắt lỗi toàn hệ thống và hiển thị trực tiếp lên giao diện để dễ debug
        window.onerror = function (message, source, lineno, colno, error) {
            console.error("Lỗi hệ thống:", message, source, lineno, colno, error);
            try {
                const errDiv = document.createElement('div');
                errDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #ef4444; color: white; padding: 15px; z-index: 99999; font-family: monospace; font-size: 14px; line-height: 1.5; border-bottom: 2px solid #b91c1c; text-align: left;';
                errDiv.innerHTML = `<strong>Lỗi tải trang JS:</strong> ${message}<br><small>Tệp: ${source ? source.split('/').pop() : 'unknown'} | Dòng: ${lineno}:${colno}</small><br><button onclick="this.parentElement.remove()" style="margin-top: 10px; background: white; color: #ef4444; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">Đóng</button>`;
                document.body.appendChild(errDiv);
            } catch(e) {}
            return false;
        };

        // ========== CONFIG ==========
        const SB_URL = 'https://ozpaslchfhcdechmrhlv.supabase.co';
        const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGFzbGNoZmhjZGVjaG1yaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTQxMDUsImV4cCI6MjA5ODY5MDEwNX0.Ekzyal8ona_CjoBkHV19iaDm20DXqCV4MJanSseZ1lo';
        
        let supabaseClient;
        try {
            if (!window.supabase) {
                throw new Error("Không thể tải thư viện Supabase từ CDN (jsDelivr / UNPKG). Vui lòng kiểm tra lại kết nối Internet.");
            }
            supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
        } catch (e) {
            console.error(e);
            document.addEventListener("DOMContentLoaded", () => {
                const tableBody = document.getElementById('tableBody');
                if (tableBody) {
                    tableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                        <b>Lỗi khởi tạo ứng dụng:</b> ${e.message}<br>
                        <span style="color: var(--text-muted); font-size: 13px;">Vui lòng thử đổi DNS hoặc bật VPN, rồi tải lại trang (F5).</span>
                    </td></tr>`;
                }
            });
        }

        let customers = [];
        let currentUserEmail = null;
        let isEditing = false;
        let pendingCustomerData = null;
        let pendingActionData = null;
        let pendingNotification = null;
        let currentPage = 1;
        const itemsPerPage = 10;

        const reportMonthSelect = document.getElementById('reportMonthSelect');
        const historyModal = document.getElementById('historyModal');
        const analysisModal = document.getElementById('analysisModal');
        const productAnalysisModal = document.getElementById('productAnalysisModal');
        const reportModal = document.getElementById('reportModal');

        // Elements cho chức năng Đăng nhập / Đăng xuất
        const authContainer = document.getElementById('authContainer');
        const mainContainer = document.getElementById('mainContainer');
        const authForm = document.getElementById('authForm');
        const authId = document.getElementById('authId');
        const authPassword = document.getElementById('authPassword');
        const authErrorMsg = document.getElementById('authErrorMsg');
        const btnLogout = document.getElementById('btnLogout');

        // Xử lý gửi form Đăng nhập bằng Supabase Authentication
        if (authForm) {
            authForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const id = authId.value.trim();
                const password = authPassword.value;
                const btnSubmit = document.getElementById('btnAuthSubmit');
                
                btnSubmit.innerText = 'Đang đăng nhập...';
                btnSubmit.disabled = true;
                authErrorMsg.style.display = 'none';

                try {
                    if (!supabaseClient) {
                        throw new Error("Không có kết nối đến cơ sở dữ liệu Supabase.");
                    }
                    
                    // Tự động map ID thành định dạng Email cho Supabase Auth (ví dụ: hieuhanh -> hieuhanh@daisylam.id.vn)
                    const email = id.includes('@') ? id : `${id}@daisylam.id.vn`;
                    
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: email,
                        password: password
                    });

                    if (error) throw error;
                    
                    // Khi đăng nhập thành công, onAuthStateChange sẽ tự động cập nhật UI
                } catch (err) {
                    console.error("Lỗi đăng nhập:", err);
                    let msg = err.message || "Tên đăng nhập hoặc mật khẩu không chính xác.";
                    if (msg === "Invalid login credentials") {
                        msg = "Tên đăng nhập (ID) hoặc Mật khẩu không chính xác. Vui lòng kiểm tra lại!";
                    }
                    authErrorMsg.innerText = msg;
                    authErrorMsg.style.display = 'block';
                    btnSubmit.innerText = 'Đăng nhập';
                    btnSubmit.disabled = false;
                }
            });
        }

        // Xử lý nút Đăng xuất bằng Supabase Auth
        if (btnLogout) {
            btnLogout.addEventListener('click', async function() {
                if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?")) {
                    try {
                        if (supabaseClient) {
                            await supabaseClient.auth.signOut();
                        }
                    } catch (err) {
                        console.error("Lỗi đăng xuất:", err);
                    }
                }
            });
        }

        // Lắng nghe và quản lý trạng thái Đăng nhập tự động bằng Supabase Auth
        function initAuthListener() {
            if (supabaseClient) {
                supabaseClient.auth.onAuthStateChange((event, session) => {
                    console.log("Sự kiện Auth:", event, session);
                    if (session) {
                        // Đã đăng nhập thành công
                        currentUserEmail = session.user?.email || null;
                        if (authContainer) authContainer.style.display = 'none';
                        if (mainContainer) mainContainer.style.display = 'block';
                        if (btnLogout) btnLogout.style.display = 'block';
                        
                        // Tải dữ liệu khách hàng
                        fetchCustomers();
                    } else {
                        // Chưa đăng nhập / Đăng xuất
                        currentUserEmail = null;
                        if (authContainer) authContainer.style.display = 'flex';
                        if (mainContainer) mainContainer.style.display = 'none';
                        if (btnLogout) btnLogout.style.display = 'none';
                        
                        // Reset biểu mẫu đăng nhập
                        if (authForm) authForm.reset();
                        const btnSubmit = document.getElementById('btnAuthSubmit');
                        if (btnSubmit) {
                            btnSubmit.innerText = 'Đăng nhập';
                            btnSubmit.disabled = false;
                        }
                    }
                });
            } else {
                if (authContainer) authContainer.style.display = 'flex';
                if (mainContainer) mainContainer.style.display = 'none';
            }
        }


        function mapFromSupabase(row) {
            let parsedHistory = [];
            if (typeof row.history === 'string') {
                try {
                    parsedHistory = JSON.parse(row.history);
                } catch {
                    parsedHistory = [];
                }
            } else if (Array.isArray(row.history)) {
                parsedHistory = row.history;
            }
            let cat = row.category || row.product_category || '';
            let pName = row.product_name || row.productName || '';
            let noteText = row.notes || '';
            
            if (noteText.includes('[' + 'Thể loại' + ']:')) {
                const matchCat = noteText.match(/\[Thể loại:\s*(.*?)\]/);
                if (matchCat) {
                    if (!cat) cat = matchCat[1].trim();
                    noteText = noteText.replace(/\[Thể loại:\s*(.*?)\]\s*/, '');
                }
            }
            if (noteText.includes('[' + 'Sản phẩm' + ']:')) {
                const matchP = noteText.match(/\[Sản phẩm:\s*(.*?)\]/);
                if (matchP) {
                    if (!pName) pName = matchP[1].trim();
                    noteText = noteText.replace(/\[Sản phẩm:\s*(.*?)\]\s*/, '');
                }
            }

            return {
                customerId: row.customer_id || '',
                taxId: row.tax_id || '',
                companyName: row.company_name || '',
                classification: row.classification || '',
                category: cat,
                productName: pName,
                contactName: row.contact_name || '',
                phone: row.phone || '',
                sales: Number(row.sales) || 0,
                notes: noteText,
                lastUpdated: row.updated_at || '',
                updatedBy: row.updated_by || '',
                history: parsedHistory
            };
        }

        function mapToSupabase(c) {
            const taxVal = c.taxId?.toString().trim();
            const phoneVal = c.phone?.toString().trim();
            const salesVal = c.sales?.toString().trim();

            let formattedPhone = phoneVal || null;
            if (phoneVal && /^\d+$/.test(phoneVal) && !phoneVal.startsWith('0') && !phoneVal.startsWith('+')) {
                formattedPhone = '0' + phoneVal;
            }

            let finalNotes = c.notes?.trim() || null;
            let tagParts = [];
            if (c.category?.trim()) tagParts.push(`[Thể loại: ${c.category.trim()}]`);
            if (c.productName?.trim()) tagParts.push(`[Sản phẩm: ${c.productName.trim()}]`);
            if (tagParts.length > 0) {
                finalNotes = `${tagParts.join(' ')}${finalNotes ? ' ' + finalNotes : ''}`;
            }

            return {
                customer_id: c.customerId?.trim() || '',
                tax_id: taxVal || null,
                company_name: c.companyName?.trim() || '',
                classification: c.classification || '',
                category: c.category?.trim() || null,
                product_category: c.category?.trim() || null,
                product_name: c.productName?.trim() || null,
                contact_name: c.contactName?.trim() || '',
                phone: formattedPhone,
                sales: salesVal && !isNaN(Number(salesVal)) ? Number(salesVal) : null,
                notes: finalNotes,
                updated_at: c.lastUpdated || new Date().toISOString(),
                updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
                history: Array.isArray(c.history) ? c.history : []
            };
        }

        async function fetchCustomers() {
            const tableBody = document.getElementById('tableBody');
            try {
                tableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: var(--primary-color); padding: 30px;">Đang tải dữ liệu từ máy chủ Supabase...</td></tr>`;
                
                if (!supabaseClient) {
                    throw new Error("Kết nối Supabase chưa được thiết lập. Hãy kiểm tra lỗi khởi tạo ở trên.");
                }
                
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Quá thời gian 10 giây. Hãy kiểm tra lại kết nối mạng!")), 10000));
                const fetchPromise = supabaseClient.from('Quan ly ban hang').select('*').order('sales', { ascending: false });
                
                const { data, error } = await Promise.race([fetchPromise, timeout]);
                
                if (error) {
                    console.error("Lỗi từ Supabase:", error);
                    tableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                        <b>Lỗi máy chủ:</b> ${error.message} <br>
                    </td></tr>`;
                    return;
                }
                
                customers = (data || []).map(mapFromSupabase);
                customers.forEach(cust => {
                    if (cust.category && !savedCategories.includes(cust.category)) {
                        savedCategories.push(cust.category);
                    }
                });
                localStorage.setItem('savedProductCategories', JSON.stringify(savedCategories));
                renderCategoryOptions();
                renderTable();
            } catch(e) {
                console.error("Lỗi hệ thống:", e);
                tableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                    <b>Lỗi kết nối mạng:</b> ${e.message}
                </td></tr>`;
            }
        }

        const form = document.getElementById('customerForm');
        const searchInput = document.getElementById('searchInput');
        const tableBodyElement = document.getElementById('tableBody');
        const paginationContainer = document.getElementById('pagination');
        const filterClassification = document.getElementById('filterClassification');
        
        const modal = document.getElementById('duplicateModal');
        const modalMessage = document.getElementById('modalMessage');
        const deleteModal = document.getElementById('deleteModal');
        const deleteModalMessage = document.getElementById('deleteModalMessage');
        const warningModal = document.getElementById('warningModal');
        const warningModalMessage = document.getElementById('warningModalMessage');
        const notificationModal = document.getElementById('notificationModal');
        const notificationTitle = document.getElementById('notificationTitle');
        const notificationMessage = document.getElementById('notificationMessage');

        const idInput = document.getElementById('customerId');
        const customerIdWarning = document.getElementById('customerIdWarning');
        const taxIdInput = document.getElementById('taxId');
        const companyInput = document.getElementById('companyName');
        const classificationInput = document.getElementById('classification');
        const contactInput = document.getElementById('contactName');
        const phoneInput = document.getElementById('phone');
        
        const salesLabel = document.getElementById('salesLabel');
        const salesInput = document.getElementById('sales');
        const addSalesContainer = document.getElementById('addSalesContainer');
        const addSalesInput = document.getElementById('addSales');
        const notesInput = document.getElementById('notes');

        const btnSubmit = document.getElementById('btnSubmit');
        const editActions = document.getElementById('editActions');
        const btnCancelEdit = document.getElementById('btnCancelEdit');
        const btnUpdate = document.getElementById('btnUpdate');
        const btnDelete = document.getElementById('btnDelete');
        
        const fileInputExcel = document.getElementById('fileInputExcel');
        let customerToDelete = null;

        function formatInputWithCommas(e) {
            let isNegative = this.value.startsWith('-');
            let rawValue = this.value.replace(/\D/g, ''); 
            let formatted = rawValue ? parseInt(rawValue, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : '';
            if (isNegative && formatted) this.value = '-' + formatted;
            else if (isNegative && !formatted) this.value = '-'; 
            else this.value = formatted;

            if (this.id === 'addSales') {
                if (isNegative && formatted) { this.style.borderColor = '#ef4444'; this.style.color = '#ef4444'; }
                else if (!isNegative && formatted) { this.style.borderColor = '#10b981'; this.style.color = '#10b981'; }
                else { this.style.borderColor = 'var(--border-color)'; this.style.color = 'var(--text-main)'; }
            }
        }
        
        function checkDuplicateCustomerId() {
            if (!idInput || !customerIdWarning) return;
            const val = idInput.value.trim();
            if (!isEditing && val) {
                const exists = customers.some(c => String(c.customerId || '').toLowerCase() === val.toLowerCase());
                if (exists) {
                    idInput.style.borderColor = '#ef4444';
                    idInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
                    customerIdWarning.style.display = 'block';
                } else {
                    idInput.style.borderColor = 'var(--border-color)';
                    idInput.style.boxShadow = 'none';
                    customerIdWarning.style.display = 'none';
                }
            } else {
                idInput.style.borderColor = 'var(--border-color)';
                idInput.style.boxShadow = 'none';
                customerIdWarning.style.display = 'none';
            }
        }

        if (idInput) {
            idInput.addEventListener('input', checkDuplicateCustomerId);
        }

        salesInput.addEventListener('input', formatInputWithCommas);
        if (addSalesInput) addSalesInput.addEventListener('input', formatInputWithCommas);

        function formatCurrency(amount) { const val = Number(amount); return (isNaN(val) ? 0 : val).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }); }
        function formatPhoneNumber(phoneVal) {
            if (!phoneVal) return '-';
            let str = phoneVal.toString().trim();
            if (!str || str === '-') return '-';
            // Nếu là số thuần túy và không bắt đầu bằng '0' hoặc '+', tự động thêm '0' ở đầu
            if (/^\d+$/.test(str) && !str.startsWith('0') && !str.startsWith('+')) {
                return '0' + str;
            }
            return str;
        }

        function closeAllModals() {
            const modalIds = [
                'customerActionModal', 'quickSalesModal', 'customerFormModal',
                'duplicateModal', 'deleteModal', 'warningModal', 'notificationModal',
                'excelImportModal', 'historyModal', 'analysisModal', 'productAnalysisModal',
                'reportModal'
            ];
            modalIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    el.classList.remove('show');
                }
            });
        }

        function showHistoryModal(customerId) {
            if (!customerId) {
                console.error('❌ showHistoryModal: customerId is empty');
                return;
            }
            console.log('🔍 [showHistoryModal] Bắt đầu - customerId:', customerId);
            
            // Đóng các modal khác TRƯỚC KHI mở modal lịch sử
            const modalsToClose = ['customerActionModal', 'quickSalesModal', 'customerFormModal', 'duplicateModal', 'deleteModal', 'warningModal', 'notificationModal', 'excelImportModal', 'analysisModal', 'productAnalysisModal', 'reportModal'];
            modalsToClose.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    el.classList.remove('show');
                    console.log(`🔒 Đã đóng modal: ${id}`);
                }
            });
            
            const historyModal = document.getElementById('historyModal');
            if (!historyModal) {
                console.error('❌ Không tìm thấy element historyModal trong DOM');
                alert('Lỗi: Không tìm thấy modal lịch sử trong hệ thống!');
                return;
            }
            
            console.log('✅ Tìm thấy historyModal');
            
            const customer = customers.find(c => String(c.customerId || '').trim().toLowerCase() === String(customerId || '').trim().toLowerCase());
            if (!customer) {
                console.warn(`⚠️ Không tìm thấy dữ liệu lịch sử cho khách hàng "${customerId}"`);
                const timelineContainer = document.getElementById('historyTimelineContainer');
                if (timelineContainer) {
                    timelineContainer.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">❌ Không tìm thấy dữ liệu khách hàng này trong hệ thống.</div>`;
                }
                // Vẫn hiển thị modal dù không có data
                historyModal.style.display = 'flex';
                historyModal.style.zIndex = '99999';
                return;
            }
            
            console.log('✅ Tìm thấy dữ liệu khách hàng:', customer.customerId);

            const metaContainer = document.getElementById('historyModalMeta');
            if (metaContainer) {
                metaContainer.innerHTML = `
                    <strong>Mã khách hàng:</strong> <span style="color: #3b82f6; font-weight: 700;">${customer.customerId}</span><br>
                    <strong>Tên Công ty:</strong> ${customer.companyName || '<span style="color: var(--text-muted);">Chưa có thông tin</span>'}<br>
                    <strong>Doanh số hiện tại:</strong> <span style="color: #10b981; font-weight: 700;">${formatCurrency(customer.sales)}</span>
                `;
            }

            const timelineContainer = document.getElementById('historyTimelineContainer');
            if (!timelineContainer) {
                console.error('❌ Không tìm thấy element historyTimelineContainer');
                return;
            }
            timelineContainer.innerHTML = '';

            const history = customer.history || [];
            console.log(`📜 Khách hàng ${customerId} có ${history.length} bản ghi lịch sử`, history);
            
            if (history.length === 0) {
                timelineContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #94a3b8; margin-bottom: 10px;">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div style="font-weight: 600; margin-bottom: 5px;">Chưa có lịch sử cập nhật</div>
                    <div style="font-size: 12px;">Khách hàng này chưa có bản ghi nào trong lịch sử thay đổi.</div>
                </div>`;
            } else {
                // Sắp xếp lịch sử theo thời gian mới nhất lên đầu
                const sortedHistory = Array.isArray(history) ? [...history].sort((a, b) => {
                    const timeA = new Date(a.date || a.timestamp || 0).getTime();
                    const timeB = new Date(b.date || b.timestamp || 0).getTime();
                    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
                }) : [];
                
                const ul = document.createElement('div');
                ul.style.position = 'relative';
                ul.style.paddingLeft = '24px';
                ul.style.borderLeft = '2px solid #e2e8f0';
                ul.style.marginLeft = '12px';
                ul.style.display = 'flex';
                ul.style.flexDirection = 'column';
                ul.style.gap = '20px';

                sortedHistory.forEach((item, idx) => {
                    let formattedDate = '-';
                    let formattedTime = '-';
                    try {
                        const rawDate = item.date || item.timestamp;
                        if (rawDate) {
                            const itemDate = new Date(rawDate);
                            if (!isNaN(itemDate.getTime())) {
                                formattedDate = itemDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                formattedTime = itemDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                            }
                        }
                    } catch (dateErr) {
                        console.error('Lỗi định dạng ngày:', dateErr);
                    }
                    const user = item.updated_by || item.user || 'hệ thống';

                    let itemCategory = item.category || '';
                    let itemProduct = item.productName || item.product_name || '';
                    let noteText = item.note || 'Cập nhật thông tin';

                    // Bóc tách Thể loại & Sản phẩm từ note nếu có
                    if (!itemCategory && noteText) {
                        const catMatch = noteText.match(/\[Thể loại:\s*([^\]]+)\]/i);
                        if (catMatch) itemCategory = catMatch[1].trim();
                    }
                    if (!itemProduct && noteText) {
                        const prodMatch = noteText.match(/\[Sản phẩm:\s*([^\]]+)\]/i);
                        if (prodMatch) itemProduct = prodMatch[1].trim();
                    }

                    // Tách bóc ghi chú thuần túy để hiển thị tiêu đề
                    let cleanNote = noteText.replace(/\[Thể loại:\s*[^\]]+\]/gi, '').replace(/\[Sản phẩm:\s*[^\]]+\]/gi, '').trim();
                    if (!cleanNote) cleanNote = 'Cập nhật thông tin';

                    const itemDiv = document.createElement('div');
                    itemDiv.style.position = 'relative';
                    
                    // Dot với màu khác nhau cho bản ghi đầu tiên (mới nhất)
                    const dot = document.createElement('div');
                    const dotColor = idx === 0 ? '#10b981' : 'var(--primary-color)';
                    dot.style.cssText = `position: absolute; left: -31px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background-color: ${dotColor}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;
                    itemDiv.appendChild(dot);

                    // Content card
                    const content = document.createElement('div');
                    content.style.fontSize = '14px';
                    content.style.lineHeight = '1.6';

                    // Time header
                    const timeHeader = document.createElement('div');
                    timeHeader.style.fontSize = '12px';
                    timeHeader.style.color = 'var(--text-muted)';
                    timeHeader.style.fontWeight = 'bold';
                    timeHeader.innerHTML = `📅 ${formattedDate} <span style="margin: 0 6px; color: #cbd5e1;">•</span> ⏰ ${formattedTime}`;
                    content.appendChild(timeHeader);

                    // Action title
                    const actionTitle = document.createElement('div');
                    actionTitle.style.fontWeight = 'bold';
                    actionTitle.style.color = 'var(--text-main)';
                    actionTitle.style.marginTop = '4px';
                    actionTitle.style.fontSize = '15px';
                    actionTitle.innerText = cleanNote;
                    content.appendChild(actionTitle);

                    // Details box
                    const detailsBox = document.createElement('div');
                    detailsBox.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-top: 8px;';
                    
                    let detailsHtml = `<ul style="margin: 0; padding-left: 15px; list-style-type: disc; color: #475569; font-size: 13px; line-height: 1.7;">`;
                    detailsHtml += `<li>Thực hiện bởi: <strong>${user}</strong></li>`;
                    if (item.amount !== undefined && item.amount !== null && item.amount !== 0) {
                        const amountPrefix = item.amount > 0 ? '+' : '';
                        detailsHtml += `<li>Biến động doanh số: <strong style="color: ${item.amount > 0 ? '#10b981' : '#ef4444'}">${amountPrefix}${formatCurrency(item.amount)}</strong></li>`;
                    }
                    detailsHtml += `</ul>`;
                    
                    detailsBox.innerHTML = detailsHtml;
                    content.appendChild(detailsBox);
                    itemDiv.appendChild(content);
                    ul.appendChild(itemDiv);
                });
                timelineContainer.appendChild(ul);
            }
            
            // QUAN TRỌNG: Hiển thị modal SAU KHI đã render xong nội dung
            console.log('🎨 Bắt đầu hiển thị modal...');
            
            // Xóa tất cả inline styles cũ
            historyModal.style.cssText = '';
            
            // Set inline styles để FORCE hiển thị
            historyModal.style.display = 'flex';
            historyModal.style.position = 'fixed';
            historyModal.style.top = '0';
            historyModal.style.left = '0';
            historyModal.style.right = '0';
            historyModal.style.bottom = '0';
            historyModal.style.width = '100vw';
            historyModal.style.height = '100vh';
            historyModal.style.zIndex = '99999';
            historyModal.style.visibility = 'visible';
            historyModal.style.opacity = '1';
            historyModal.style.backgroundColor = 'rgba(23, 51, 44, 0.45)';
            historyModal.style.justifyContent = 'center';
            historyModal.style.alignItems = 'center';
            
            // Thêm class show
            historyModal.classList.add('show');
            
            // Force reflow
            historyModal.offsetHeight;
            
            console.log('✅✅✅ MODAL LỊCH SỬ ĐÃ HIỂN THỊ!');
        }

        const btnCloseHistoryModal = document.getElementById('btnCloseHistoryModal');
        if (btnCloseHistoryModal) {
            btnCloseHistoryModal.onclick = () => {
                const historyModal = document.getElementById('historyModal');
                if (historyModal) {
                    historyModal.classList.remove('show');
                    historyModal.style.display = 'none';
                    historyModal.style.visibility = 'hidden';
                    historyModal.style.opacity = '0';
                }
            };
        }
        const btnCloseHistoryBtn = document.getElementById('btnCloseHistoryBtn');
        if (btnCloseHistoryBtn) {
            btnCloseHistoryBtn.onclick = () => {
                const historyModal = document.getElementById('historyModal');
                if (historyModal) {
                    historyModal.classList.remove('show');
                    historyModal.style.display = 'none';
                    historyModal.style.visibility = 'hidden';
                    historyModal.style.opacity = '0';
                }
            };
        }
        function formatDateTime(isoString) {
            if (!isoString) return '-';
            const d = new Date(isoString);
            return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        const classificationColors = {
            "Khách mới": "#3b82f6", "Thường xuyên": "#D4AF37", "Không thường xuyên": "#FC5A8D",
            "Chưa liên hệ được": "#10b981", "Không nhu cầu": "#ef4444"
        };

        const customCategoryDropdown = document.getElementById('customCategoryDropdown');
        const customCategorySelect = document.getElementById('customCategorySelect');
        const customCategorySelectedText = document.getElementById('customCategorySelectedText');
        const customCategoryMenu = document.getElementById('customCategoryMenu');
        const productNameInput = document.getElementById('productName');
        let currentCategoryValue = '';

        let savedCategories = JSON.parse(localStorage.getItem('savedProductCategories') || '[]');
        if (!Array.isArray(savedCategories)) {
            savedCategories = [];
        }

        function renderCategoryOptions(selectedVal = '') {
            currentCategoryValue = selectedVal || '';
            if (selectedVal && !savedCategories.includes(selectedVal)) {
                savedCategories.push(selectedVal);
                localStorage.setItem('savedProductCategories', JSON.stringify(savedCategories));
            }
            updateCustomCategorySelectedText();
            renderCustomCategoryMenu();
        }

        function updateCustomCategorySelectedText() {
            if (!customCategorySelectedText) return;
            if (currentCategoryValue) {
                customCategorySelectedText.innerText = currentCategoryValue;
                customCategorySelectedText.style.color = 'var(--text-main)';
                customCategorySelectedText.style.fontWeight = '600';
            } else {
                customCategorySelectedText.innerText = '-- Chọn thể loại --';
                customCategorySelectedText.style.color = 'var(--text-muted)';
                customCategorySelectedText.style.fontWeight = 'normal';
            }
        }

        function renderCustomCategoryMenu() {
            if (!customCategoryMenu) return;
            customCategoryMenu.innerHTML = '';

            // 1. Default Option: -- Chọn thể loại --
            const defaultItem = document.createElement('div');
            defaultItem.style.cssText = 'padding: 8px 12px; border-radius: 6px; cursor: pointer; color: var(--text-muted); font-size: 14px; transition: background 0.15s;';
            defaultItem.innerText = '-- Chọn thể loại --';
            defaultItem.onmouseover = () => defaultItem.style.background = '#FAF8F5';
            defaultItem.onmouseout = () => defaultItem.style.background = 'transparent';
            defaultItem.onclick = (e) => {
                e.stopPropagation();
                currentCategoryValue = '';
                updateCustomCategorySelectedText();
                customCategoryMenu.style.display = 'none';
            };
            customCategoryMenu.appendChild(defaultItem);

            // 2. Saved Categories List with inline red X icons
            savedCategories.forEach(cat => {
                const itemRow = document.createElement('div');
                itemRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: background 0.15s; margin-bottom: 2px;';
                if (cat === currentCategoryValue) {
                    itemRow.style.background = '#F3ECE6';
                }

                itemRow.onmouseover = () => { if (cat !== currentCategoryValue) itemRow.style.background = '#FAF8F5'; };
                itemRow.onmouseout = () => { if (cat !== currentCategoryValue) itemRow.style.background = 'transparent'; };

                // Left text
                const textSpan = document.createElement('span');
                textSpan.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--text-main); flex: 1;';
                textSpan.innerText = cat;

                // Right inline X delete icon button
                const deleteBtn = document.createElement('span');
                deleteBtn.title = `Xóa thể loại "${cat}"`;
                deleteBtn.innerText = '✕';
                deleteBtn.style.cssText = 'color: #C25447; font-weight: bold; font-size: 14px; padding: 2px 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s;';
                deleteBtn.onmouseover = (e) => { e.stopPropagation(); deleteBtn.style.background = '#FCEAE8'; };
                deleteBtn.onmouseout = (e) => { e.stopPropagation(); deleteBtn.style.background = 'transparent'; };
                
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Bạn có chắc muốn xóa thể loại "${cat}" khỏi danh sách không?`)) {
                        savedCategories = savedCategories.filter(c => c !== cat);
                        localStorage.setItem('savedProductCategories', JSON.stringify(savedCategories));
                        if (currentCategoryValue === cat) {
                            currentCategoryValue = '';
                            updateCustomCategorySelectedText();
                        }
                        renderCustomCategoryMenu();
                    }
                };

                itemRow.onclick = (e) => {
                    e.stopPropagation();
                    currentCategoryValue = cat;
                    updateCustomCategorySelectedText();
                    customCategoryMenu.style.display = 'none';
                };

                itemRow.appendChild(textSpan);
                itemRow.appendChild(deleteBtn);
                customCategoryMenu.appendChild(itemRow);
            });

            // 3. Bottom Option: + Thêm thể loại mới...
            const addItem = document.createElement('div');
            addItem.style.cssText = 'padding: 10px 12px; border-top: 1px solid var(--border-color); color: var(--primary-color); font-weight: 600; font-size: 13px; cursor: pointer; margin-top: 4px; border-radius: 6px;';
            addItem.innerText = '+ Thêm thể loại mới...';
            addItem.onmouseover = () => addItem.style.background = '#FAF8F5';
            addItem.onmouseout = () => addItem.style.background = 'transparent';
            addItem.onclick = (e) => {
                e.stopPropagation();
                customCategoryMenu.style.display = 'none';
                const newCat = prompt("Nhập tên thể loại hàng mới (ví dụ: CPU, Laptop, Camera...):");
                if (newCat && newCat.trim()) {
                    const trimmed = newCat.trim();
                    if (!savedCategories.includes(trimmed)) {
                        savedCategories.push(trimmed);
                        localStorage.setItem('savedProductCategories', JSON.stringify(savedCategories));
                    }
                    renderCategoryOptions(trimmed);
                }
            };
            customCategoryMenu.appendChild(addItem);
        }

        if (customCategorySelect) {
            customCategorySelect.addEventListener('click', function(e) {
                e.stopPropagation();
                if (customCategoryMenu) {
                    const isVisible = customCategoryMenu.style.display === 'block';
                    customCategoryMenu.style.display = isVisible ? 'none' : 'block';
                }
            });
        }

        document.addEventListener('click', function(e) {
            if (customCategoryMenu && !customCategoryDropdown?.contains(e.target)) {
                customCategoryMenu.style.display = 'none';
            }
        });

        document.addEventListener("DOMContentLoaded", () => {
            renderCategoryOptions();
        });

        function getFormData() {
            let parsedSales = Number(salesInput.value.replace(/[,.]/g, ''));
            if (isNaN(parsedSales)) parsedSales = 0;
            return {
                customerId: idInput ? idInput.value.trim() : '', taxId: taxIdInput ? taxIdInput.value.trim() : '',
                companyName: companyInput ? companyInput.value.trim() : '', classification: classificationInput ? classificationInput.value : '',
                category: currentCategoryValue || '',
                productName: productNameInput ? productNameInput.value.trim() : '',
                contactName: contactInput ? contactInput.value.trim() : '', phone: phoneInput ? phoneInput.value.trim() : '',
                sales: parsedSales, notes: notesInput ? notesInput.value.trim() : ''
            };
        }

        function setFormData(data) {
            if (idInput) idInput.value = data.customerId || ''; if (taxIdInput) taxIdInput.value = data.taxId || '';
            if (companyInput) companyInput.value = data.companyName || ''; if (classificationInput) classificationInput.value = data.classification || '';
            renderCategoryOptions(data.category || '');
            if (productNameInput) productNameInput.value = data.productName || '';
            if (contactInput) contactInput.value = data.contactName || ''; if (phoneInput) phoneInput.value = data.phone ? formatPhoneNumber(data.phone) : '';
            if (salesInput) salesInput.value = data.sales || data.sales === 0 ? data.sales.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : '';
            if (notesInput) notesInput.value = data.notes || '';
        }

        let selectedCustomerForAction = null;
        let qsCurrentCategoryValue = '';

        const customerActionModal = document.getElementById('customerActionModal');
        const actionModalCustId = document.getElementById('actionModalCustId');
        const actionModalCompName = document.getElementById('actionModalCompName');
        const btnCloseActionModal = document.getElementById('btnCloseActionModal');
        const btnCancelActionModal = document.getElementById('btnCancelActionModal');
        const btnOptionEditInfo = document.getElementById('btnOptionEditInfo');
        const btnOptionUpdateSales = document.getElementById('btnOptionUpdateSales');

        const quickSalesModal = document.getElementById('quickSalesModal');
        const quickSalesCustInfo = document.getElementById('quickSalesCustInfo');
        const btnCloseQuickSalesModal = document.getElementById('btnCloseQuickSalesModal');
        const btnCancelQuickSales = document.getElementById('btnCancelQuickSales');
        const quickSalesForm = document.getElementById('quickSalesForm');
        const qsAmount = document.getElementById('qsAmount');
        const qsProductName = document.getElementById('qsProductName');
        const qsNote = document.getElementById('qsNote');

        const qsCustomCategoryDropdown = document.getElementById('qsCustomCategoryDropdown');
        const qsCustomCategorySelect = document.getElementById('qsCustomCategorySelect');
        const qsCustomCategorySelectedText = document.getElementById('qsCustomCategorySelectedText');
        const qsCustomCategoryMenu = document.getElementById('qsCustomCategoryMenu');

        if (qsAmount) qsAmount.addEventListener('input', formatInputWithCommas);

        function openCustomerActionModal(customer) {
            console.log('🔵 Mở modal action cho khách hàng:', customer.customerId);
            
            // Đóng các modal khác NGOẠI TRỪ customerActionModal
            const modalsToClose = ['quickSalesModal', 'customerFormModal', 'duplicateModal', 'deleteModal', 'warningModal', 'notificationModal', 'excelImportModal', 'historyModal', 'analysisModal', 'productAnalysisModal', 'reportModal'];
            modalsToClose.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    el.classList.remove('show');
                }
            });
            
            selectedCustomerForAction = customer;
            if (actionModalCustId) actionModalCustId.innerText = customer.customerId || '';
            if (actionModalCompName) actionModalCompName.innerText = customer.companyName ? `(${customer.companyName})` : '';
            
            if (customerActionModal) {
                customerActionModal.style.display = 'flex';
                customerActionModal.classList.add('show');
                console.log('✅ Modal action đã được mở');
            } else {
                console.error('❌ Không tìm thấy customerActionModal');
            }
        }

        function closeCustomerActionModal() {
            if (customerActionModal) {
                customerActionModal.classList.remove('show');
                setTimeout(() => {
                    customerActionModal.style.display = 'none';
                }, 200);
            }
        }

        function closeQuickSalesModal() {
            if (quickSalesModal) {
                quickSalesModal.classList.remove('show');
                setTimeout(() => {
                    quickSalesModal.style.display = 'none';
                }, 200);
            }
        }

        function renderQsCategoryOptions(selectedVal = '') {
            qsCurrentCategoryValue = selectedVal || '';
            updateQsCustomCategorySelectedText();
            renderQsCustomCategoryMenu();
        }

        function updateQsCustomCategorySelectedText() {
            if (!qsCustomCategorySelectedText) return;
            if (qsCurrentCategoryValue) {
                qsCustomCategorySelectedText.innerText = qsCurrentCategoryValue;
                qsCustomCategorySelectedText.style.color = 'var(--text-main)';
                qsCustomCategorySelectedText.style.fontWeight = '600';
            } else {
                qsCustomCategorySelectedText.innerText = '-- Chọn thể loại --';
                qsCustomCategorySelectedText.style.color = 'var(--text-muted)';
                qsCustomCategorySelectedText.style.fontWeight = 'normal';
            }
        }

        function renderQsCustomCategoryMenu() {
            if (!qsCustomCategoryMenu) return;
            qsCustomCategoryMenu.innerHTML = '';

            const defaultItem = document.createElement('div');
            defaultItem.style.cssText = 'padding: 8px 12px; border-radius: 6px; cursor: pointer; color: var(--text-muted); font-size: 14px; transition: background 0.15s;';
            defaultItem.innerText = '-- Chọn thể loại --';
            defaultItem.onmouseover = () => defaultItem.style.background = '#FAF8F5';
            defaultItem.onmouseout = () => defaultItem.style.background = 'transparent';
            defaultItem.onclick = (e) => {
                e.stopPropagation();
                qsCurrentCategoryValue = '';
                updateQsCustomCategorySelectedText();
                qsCustomCategoryMenu.style.display = 'none';
            };
            qsCustomCategoryMenu.appendChild(defaultItem);

            savedCategories.forEach(cat => {
                const itemRow = document.createElement('div');
                itemRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: background 0.15s; margin-bottom: 2px;';
                if (cat === qsCurrentCategoryValue) itemRow.style.background = '#F3ECE6';

                itemRow.onmouseover = () => { if (cat !== qsCurrentCategoryValue) itemRow.style.background = '#FAF8F5'; };
                itemRow.onmouseout = () => { if (cat !== qsCurrentCategoryValue) itemRow.style.background = 'transparent'; };

                const textSpan = document.createElement('span');
                textSpan.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--text-main); flex: 1;';
                textSpan.innerText = cat;

                const deleteBtn = document.createElement('span');
                deleteBtn.title = `Xóa thể loại "${cat}"`;
                deleteBtn.innerText = '✕';
                deleteBtn.style.cssText = 'color: #C25447; font-weight: bold; font-size: 14px; padding: 2px 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s;';
                deleteBtn.onmouseover = (e) => { e.stopPropagation(); deleteBtn.style.background = '#FCEAE8'; };
                deleteBtn.onmouseout = (e) => { e.stopPropagation(); deleteBtn.style.background = 'transparent'; };
                
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Bạn có chắc muốn xóa thể loại "${cat}" khỏi danh sách không?`)) {
                        savedCategories = savedCategories.filter(c => c !== cat);
                        localStorage.setItem('savedProductCategories', JSON.stringify(savedCategories));
                        if (qsCurrentCategoryValue === cat) {
                            qsCurrentCategoryValue = '';
                            updateQsCustomCategorySelectedText();
                        }
                        renderQsCustomCategoryMenu();
                        renderCustomCategoryMenu();
                    }
                };

                itemRow.onclick = (e) => {
                    e.stopPropagation();
                    qsCurrentCategoryValue = cat;
                    updateQsCustomCategorySelectedText();
                    qsCustomCategoryMenu.style.display = 'none';
                };

                itemRow.appendChild(textSpan);
                itemRow.appendChild(deleteBtn);
                qsCustomCategoryMenu.appendChild(itemRow);
            });

            const addItem = document.createElement('div');
            addItem.style.cssText = 'padding: 10px 12px; border-top: 1px solid var(--border-color); color: var(--primary-color); font-weight: 600; font-size: 13px; cursor: pointer; margin-top: 4px; border-radius: 6px;';
            addItem.innerText = '+ Thêm thể loại mới...';
            addItem.onmouseover = () => addItem.style.background = '#FAF8F5';
            addItem.onmouseout = () => addItem.style.background = 'transparent';
            addItem.onclick = (e) => {
                e.stopPropagation();
                qsCustomCategoryMenu.style.display = 'none';
                const newCat = prompt("Nhập tên thể loại hàng mới (ví dụ: CPU, Laptop, Camera...):");
                if (newCat && newCat.trim()) {
                    const trimmed = newCat.trim();
                    if (!savedCategories.includes(trimmed)) {
                        savedCategories.push(trimmed);
                        localStorage.setItem('savedProductCategories', JSON.stringify(savedCategories));
                    }
                    renderQsCategoryOptions(trimmed);
                    renderCategoryOptions(trimmed);
                }
            };
            qsCustomCategoryMenu.appendChild(addItem);
        }

        if (qsCustomCategorySelect) {
            qsCustomCategorySelect.addEventListener('click', function(e) {
                e.stopPropagation();
                if (qsCustomCategoryMenu) {
                    const isVisible = qsCustomCategoryMenu.style.display === 'block';
                    qsCustomCategoryMenu.style.display = isVisible ? 'none' : 'block';
                }
            });
        }

        document.addEventListener('click', function(e) {
            if (qsCustomCategoryMenu && !qsCustomCategoryDropdown?.contains(e.target)) {
                qsCustomCategoryMenu.style.display = 'none';
            }
        });

        if (btnCloseActionModal) btnCloseActionModal.addEventListener('click', closeCustomerActionModal);
        if (btnCancelActionModal) btnCancelActionModal.addEventListener('click', closeCustomerActionModal);
        if (btnCloseQuickSalesModal) btnCloseQuickSalesModal.addEventListener('click', closeQuickSalesModal);
        if (btnCancelQuickSales) btnCancelQuickSales.addEventListener('click', closeQuickSalesModal);

        if (btnOptionEditInfo) {
            btnOptionEditInfo.addEventListener('click', function() {
                console.log('🔵 Mở modal chỉnh sửa thông tin');
                closeCustomerActionModal();
                if (selectedCustomerForAction) {
                    setFormData(selectedCustomerForAction);
                    toggleEditMode(true);
                    openCustomerFormModal();
                    console.log('✅ Modal chỉnh sửa đã mở');
                }
            });
        }

        if (btnOptionUpdateSales) {
            btnOptionUpdateSales.addEventListener('click', function() {
                console.log('🔵 Mở modal cập nhật doanh số');
                closeCustomerActionModal();
                if (selectedCustomerForAction) {
                    if (quickSalesCustInfo) quickSalesCustInfo.innerText = `${selectedCustomerForAction.customerId} - ${selectedCustomerForAction.companyName || ''}`;
                    if (qsAmount) qsAmount.value = '';
                    if (qsProductName) qsProductName.value = selectedCustomerForAction.productName || '';
                    if (qsNote) qsNote.value = '';
                    renderQsCategoryOptions(selectedCustomerForAction.category || '');
                    if (quickSalesModal) {
                        quickSalesModal.style.display = 'flex';
                        quickSalesModal.classList.add('show');
                        console.log('✅ Modal cập nhật doanh số đã mở');
                    }
                }
            });
        }

        // Option 3: Xem lịch sử
        const btnOptionViewHistory = document.getElementById('btnOptionViewHistory');
        if (btnOptionViewHistory) {
            btnOptionViewHistory.addEventListener('click', function() {
                console.log('🔵 Mở modal xem lịch sử từ action modal');
                
                // Đóng modal action NGAY LẬP TỨC (không dùng setTimeout)
                if (customerActionModal) {
                    customerActionModal.classList.remove('show');
                    customerActionModal.style.display = 'none';
                }
                
                if (selectedCustomerForAction) {
                    console.log('🚀 Đang gọi showHistoryModal...');
                    showHistoryModal(selectedCustomerForAction.customerId);
                }
            });
        }

        if (quickSalesForm) {
            quickSalesForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                if (!selectedCustomerForAction) return;

                const rawAmount = qsAmount.value.replace(/[,.]/g, '');
                const addedSales = Number(rawAmount);
                if (isNaN(addedSales) || addedSales === 0) {
                    alert("Vui lòng nhập số tiền doanh số phát sinh hợp lệ!");
                    return;
                }

                const btnSave = document.getElementById('btnSaveQuickSales');
                btnSave.innerText = 'Đang lưu...';
                btnSave.disabled = true;

                try {
                    const currentTotal = Number(selectedCustomerForAction.sales) || 0;
                    const newTotal = currentTotal + addedSales;
                    selectedCustomerForAction.sales = newTotal;
                    if (qsCurrentCategoryValue) selectedCustomerForAction.category = qsCurrentCategoryValue;
                    if (qsProductName) selectedCustomerForAction.productName = qsProductName.value.trim();

                    const historyItem = {
                        timestamp: new Date().toISOString(),
                        date: new Date().toISOString(),
                        user: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
                        updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
                        amount: addedSales,
                        category: selectedCustomerForAction.category || '',
                        productName: selectedCustomerForAction.productName || '',
                        note: qsNote.value.trim() ? `[Thể loại: ${selectedCustomerForAction.category || '-'}] [Sản phẩm: ${selectedCustomerForAction.productName || '-'}] ${qsNote.value.trim()}` : `[Thể loại: ${selectedCustomerForAction.category || '-'}] [Sản phẩm: ${selectedCustomerForAction.productName || '-'}] Cập nhật doanh số (${addedSales > 0 ? '+' : ''}${formatCurrency(addedSales)})`
                    };

                    if (!Array.isArray(selectedCustomerForAction.history)) {
                        selectedCustomerForAction.history = [];
                    }
                    selectedCustomerForAction.history.push(historyItem);

                    const payload = mapToSupabase(selectedCustomerForAction);
                    const { error } = await supabaseClient.from('Quan ly ban hang').update(payload).eq('customer_id', selectedCustomerForAction.customerId);

                    if (error) throw error;

                    renderTable();
                    closeQuickSalesModal();
                    alert(`Đã cập nhật doanh số (+${formatCurrency(addedSales)}) và sản phẩm thành công cho khách hàng ${selectedCustomerForAction.customerId}!`);
                } catch (err) {
                    console.error("Lỗi cập nhật doanh số:", err);
                    alert("Không thể lưu doanh số: " + err.message);
                } finally {
                    btnSave.innerText = 'Lưu Doanh Số & Sản Phẩm';
                    btnSave.disabled = false;
                }
            });
        }

        const customerFormModal = document.getElementById('customerFormModal');
        const btnCloseCustomerFormModal = document.getElementById('btnCloseCustomerFormModal');

        function openCustomerFormModal() {
            // Đóng các modal khác NGOẠI TRỪ customerFormModal
            const modalsToClose = ['customerActionModal', 'quickSalesModal', 'duplicateModal', 'deleteModal', 'warningModal', 'notificationModal', 'excelImportModal', 'historyModal', 'analysisModal', 'productAnalysisModal', 'reportModal'];
            modalsToClose.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    el.classList.remove('show');
                }
            });
            
            if (customerFormModal) {
                customerFormModal.style.display = 'flex';
                customerFormModal.classList.add('show');
            }
        }

        function closeCustomerFormModal() {
            if (customerFormModal) {
                customerFormModal.classList.remove('show');
                setTimeout(() => {
                    customerFormModal.style.display = 'none';
                }, 200);
            }
        }

        if (btnCloseCustomerFormModal) btnCloseCustomerFormModal.addEventListener('click', closeCustomerFormModal);

        function toggleEditMode(editing) {
            isEditing = editing;
            const formTitle = document.getElementById('formTitle');
            if (editing) {
                if (formTitle) formTitle.innerText = "📝 Chỉnh Sửa Thông Tin Khách Hàng";
                if (salesLabel) salesLabel.innerText = "Doanh số hiện tại (VNĐ)";
                if (btnSubmit) btnSubmit.style.display = 'none';
                if (editActions) editActions.style.display = 'flex';
                if (idInput) { idInput.readOnly = true; idInput.style.backgroundColor = '#f1f5f9'; }
                if (salesInput) { salesInput.readOnly = true; salesInput.style.backgroundColor = '#f1f5f9'; }
            } else {
                if (formTitle) formTitle.innerText = "➕ Thêm Khách Hàng Mới";
                if (salesLabel) salesLabel.innerText = "Doanh số ban đầu (VNĐ)";
                if (btnSubmit) btnSubmit.style.display = 'block';
                if (editActions) editActions.style.display = 'none';
                if (idInput) { idInput.readOnly = false; idInput.style.backgroundColor = '#fff'; }
                if (salesInput) { salesInput.readOnly = false; salesInput.style.backgroundColor = '#fff'; }
                setFormData({});
                checkDuplicateCustomerId();
            }
        }

        function renderPagination(totalItems) {
            paginationContainer.innerHTML = '';
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            if (totalPages <= 1) return;
            const prevBtn = document.createElement('button');
            prevBtn.className = 'page-btn'; prevBtn.innerText = 'Trước'; prevBtn.disabled = currentPage === 1;
            prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
            paginationContainer.appendChild(prevBtn);
            for (let i = 1; i <= totalPages; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`; pageBtn.innerText = i;
                pageBtn.onclick = () => { currentPage = i; renderTable(); }; paginationContainer.appendChild(pageBtn);
            }
            const nextBtn = document.createElement('button');
            nextBtn.className = 'page-btn'; nextBtn.innerText = 'Sau'; nextBtn.disabled = currentPage === totalPages;
            nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
            paginationContainer.appendChild(nextBtn);
        }

        function switchTab(tabName) {
            const tablePage = document.getElementById('tablePage');
            const formPage = document.getElementById('formPage');
            const tabBtnTable = document.getElementById('tabBtnTable');
            const tabBtnForm = document.getElementById('tabBtnForm');
            if (!tablePage || !formPage) return;

            if (tabName === 'table') {
                tablePage.style.display = 'block';
                formPage.style.display = 'none';
                if (tabBtnTable && tabBtnForm) {
                    tabBtnTable.style.background = 'var(--primary-color)';
                    tabBtnTable.style.color = '#F9F6F0';
                    tabBtnForm.style.background = 'transparent';
                    tabBtnForm.style.color = 'var(--text-muted)';
                }
            } else {
                tablePage.style.display = 'none';
                formPage.style.display = 'block';
                if (tabBtnTable && tabBtnForm) {
                    tabBtnForm.style.background = 'var(--primary-color)';
                    tabBtnForm.style.color = '#F9F6F0';
                    tabBtnTable.style.background = 'transparent';
                    tabBtnTable.style.color = 'var(--text-muted)';
                }
            }
        }

        function renderTable() {
            const query = searchInput.value.toLowerCase(); const filterClassVal = filterClassification ? filterClassification.value : '';
            let filtered = customers.filter(c => {
                const matchSearch = String(c.customerId || '').toLowerCase().includes(query) || (c.companyName && String(c.companyName).toLowerCase().includes(query)) ||
                    (c.taxId && String(c.taxId).toLowerCase().includes(query)) || (c.contactName && String(c.contactName).toLowerCase().includes(query)) ||
                    (c.phone && String(c.phone).includes(query)) || (c.classification && String(c.classification).toLowerCase().includes(query));
                const matchClass = filterClassVal === '' || c.classification === filterClassVal;
                return matchSearch && matchClass;
            });
            filtered.sort((a, b) => b.sales - a.sales);
            const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            const startIndex = (currentPage - 1) * itemsPerPage;
            const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);
            
            tableBodyElement.innerHTML = '';
            if (paginatedItems.length === 0) {
                tableBodyElement.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #94a3b8; padding: 30px;">Không có dữ liệu.</td></tr>`;
                paginationContainer.innerHTML = ''; return;
            }
            paginatedItems.forEach((customer, index) => {
                const tr = document.createElement('tr');
                // Không gán sự kiện onclick cho toàn bộ hàng nữa
                
                let salesColor = customer.sales >= 0 ? '#10b981' : '#ef4444';
                let maKhColor = (customer.classification && classificationColors[customer.classification]) ? classificationColors[customer.classification] : 'var(--primary-color)';
                let maKhTitle = customer.classification ? `Phân loại: ${customer.classification}` : 'Chưa phân loại';
                let categoryBadge = customer.category ? `<span style="display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: #F3ECE6; color: var(--primary-color); font-weight: 600;">📦 ${customer.category}</span>` : '';
                let productBadge = customer.productName ? `<span style="display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: #EFE8E0; color: var(--text-main); font-weight: 500; margin-left: 4px;">🏷️ ${customer.productName}</span>` : '';
                let productTags = (categoryBadge || productBadge) ? `<div style="margin-top: 4px;">${categoryBadge}${productBadge}</div>` : '';
                tr.innerHTML = `
                    <td class="text-center"><strong>${startIndex + index + 1}</strong></td>
                    <td class="nowrap customer-id-cell" style="color: ${maKhColor}; font-weight: bold; cursor: pointer; user-select: none;" title="${maKhTitle} - Click để chỉnh sửa thông tin">${customer.customerId}</td>
                    <td class="nowrap">${customer.taxId || '-'}</td>
                    <td><strong>${customer.companyName || '-'}</strong>${productTags}</td>
                    <td class="nowrap">${customer.contactName || '-'}</td>
                    <td class="nowrap">${formatPhoneNumber(customer.phone)}</td>
                    <td class="text-right money nowrap" style="color: ${salesColor};">${formatCurrency(customer.sales)}</td>
                    <td>${customer.notes || '-'}</td>
                `;

                // Gán sự kiện click CHỈ cho cột Mã KH
                const customerIdCell = tr.querySelector('.customer-id-cell');
                if (customerIdCell) {
                    customerIdCell.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openCustomerActionModal(customer);
                    });
                    // Thêm hiệu ứng hover cho cột Mã KH
                    customerIdCell.addEventListener('mouseenter', function() {
                        this.style.textDecoration = 'underline';
                        this.style.opacity = '0.8';
                    });
                    customerIdCell.addEventListener('mouseleave', function() {
                        this.style.textDecoration = 'none';
                        this.style.opacity = '1';
                    });
                }

                tableBodyElement.appendChild(tr);
            });
            renderPagination(filtered.length);
        }

        function checkSoftDuplicates(data) {
            let warnings = [];
            customers.forEach(c => {
                if (String(c.customerId || '').toLowerCase() !== String(data.customerId || '').toLowerCase()) {
                    if (data.taxId && c.taxId && String(c.taxId) === String(data.taxId)) warnings.push(`- <strong>Mã số thuế</strong> trùng với khách hàng <span style="color: var(--primary-color)">${c.customerId}</span>`);
                    if (data.companyName && c.companyName && String(c.companyName).toLowerCase() === String(data.companyName).toLowerCase()) warnings.push(`- <strong>Tên công ty</strong> trùng với khách hàng <span style="color: var(--primary-color)">${c.customerId}</span>`);
                    if (data.phone && c.phone && String(c.phone) === String(data.phone)) warnings.push(`- <strong>Số điện thoại</strong> trùng với khách hàng <span style="color: var(--primary-color)">${c.customerId}</span>`);
                }
            });
            return [...new Set(warnings)];
        }

        async function proceedWithSave(data, isUpdating) {
            data.lastUpdated = new Date().toISOString(); 
            btnSubmit.innerText = 'Đang lưu...'; btnSubmit.disabled = true;
            btnUpdate.innerText = 'Đang lưu...'; btnUpdate.disabled = true;

            if (isUpdating) {
                const payload = mapToSupabase(data);
                const { error } = await supabaseClient.from('Quan ly ban hang').update(payload).eq('customer_id', data.customerId);
                if (error) alert("Lỗi khi cập nhật máy chủ: " + error.message);
            } else {
                const exists = customers.find(c => String(c.customerId || '').toLowerCase() === String(data.customerId || '').toLowerCase());
                if (exists) {
                    btnSubmit.innerText = 'Lưu Thông Tin'; btnSubmit.disabled = false;
                    btnUpdate.innerText = 'Cập nhật'; btnUpdate.disabled = false;
                    pendingCustomerData = data;
                    modalMessage.innerHTML = `Mã khách hàng <strong>"${data.customerId}"</strong> đã tồn tại. Bạn có muốn cập nhật thông tin và doanh số không?`;
                    modal.style.display = 'flex';
                    return;
                } else {
                    data.history = [{
                        date: data.lastUpdated,
                        amount: data.sales,
                        category: data.category || '',
                        productName: data.productName || '',
                        note: (data.category || data.productName) ? `[Thể loại: ${data.category || '-'}] [Sản phẩm: ${data.productName || '-'}] Tạo mới` : 'Tạo mới',
                        updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống'
                    }];
                    const payload = mapToSupabase(data);
                    const { error } = await supabaseClient.from('Quan ly ban hang').insert([payload]);
                    if (error) alert("Lỗi khi thêm mới dữ liệu: " + error.message);
                }
            }

            await fetchCustomers(); 
            toggleEditMode(false); 
            closeCustomerFormModal();
            btnSubmit.innerText = 'Lưu Khách Hàng'; btnSubmit.disabled = false;
            btnUpdate.innerText = 'Cập nhật Hồ sơ'; btnUpdate.disabled = false;

            if (pendingNotification) {
                notificationTitle.innerText = pendingNotification.title;
                notificationTitle.style.color = pendingNotification.titleColor;
                notificationMessage.innerHTML = pendingNotification.message;
                notificationModal.style.display = 'flex';
                pendingNotification = null; 
            }
        }

        function handleSaveAction(data, isUpdating) {
            if (!data.customerId) return;
            const softWarnings = checkSoftDuplicates(data);
            if (softWarnings.length > 0) {
                pendingActionData = { data, isUpdating };
                warningModalMessage.innerHTML = softWarnings.join('<br>') + `<br><br>Bạn có chắc chắn muốn tiếp tục lưu thông tin này?`;
                warningModal.style.display = 'flex';
            } else { proceedWithSave(data, isUpdating); }
        }

        form.addEventListener('submit', function(e) { 
            e.preventDefault(); 
            if (isEditing) btnUpdate.click(); else handleSaveAction(getFormData(), false); 
        });

        btnUpdate.addEventListener('click', function() { 
            const data = getFormData();
            const existingCustIndex = customers.findIndex(c => String(c.customerId).toLowerCase() === String(data.customerId).toLowerCase());
            if (existingCustIndex !== -1) {
                const oldData = customers[existingCustIndex];
                const history = Array.isArray(oldData.history) ? [...oldData.history] : [];
                
                let changes = [];
                if ((data.companyName || '').trim() !== (oldData.companyName || '').trim()) changes.push(`Tên công ty`);
                if ((data.taxId || '').trim() !== (oldData.taxId || '').trim()) changes.push(`Mã số thuế`);
                if (data.classification !== oldData.classification) changes.push(`Phân loại (${oldData.classification || 'Chưa phân loại'} -> ${data.classification || 'Chưa phân loại'})`);
                if ((data.contactName || '').trim() !== (oldData.contactName || '').trim()) changes.push(`Người liên hệ`);
                if ((data.phone || '').trim() !== (oldData.phone || '').trim()) changes.push(`Số điện thoại`);
                if (data.category !== oldData.category) changes.push(`Thể loại (${oldData.category || '-'} -> ${data.category || '-'})`);
                if ((data.productName || '').trim() !== (oldData.productName || '').trim()) changes.push(`Sản phẩm (${oldData.productName || '-'} -> ${data.productName || '-'})`);
                if ((data.notes || '').trim() !== (oldData.notes || '').trim()) changes.push(`Ghi chú`);
                
                const salesDiff = (Number(data.sales) || 0) - (Number(oldData.sales) || 0);
                if (salesDiff !== 0) {
                    changes.push(`Doanh số (${salesDiff > 0 ? '+' : ''}${formatCurrency(salesDiff)})`);
                }

                if (changes.length > 0) {
                    const historyItem = {
                        timestamp: new Date().toISOString(),
                        date: new Date().toISOString(),
                        user: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
                        updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
                        amount: salesDiff,
                        category: data.category || '',
                        productName: data.productName || '',
                        note: `Cập nhật: ${changes.join(', ')}`
                    };
                    history.push(historyItem);
                }
                data.history = history;
            } else {
                data.history = [];
            }
            handleSaveAction(data, true); 
        });

        const btnAddCustomer = document.getElementById('btnAddCustomer');
        if (btnAddCustomer) {
            btnAddCustomer.addEventListener('click', function() {
                toggleEditMode(false);
                openCustomerFormModal();
            });
        }

        document.getElementById('btnCloseNotification').addEventListener('click', function() { notificationModal.style.display = 'none'; });
        document.getElementById('btnCloseAnalysisModal').addEventListener('click', () => { document.getElementById('analysisModal').style.display = 'none'; });
        document.getElementById('btnCloseAnalysisBtn').addEventListener('click', () => { document.getElementById('analysisModal').style.display = 'none'; });
        
        const btnAnalyzeCustomers = document.getElementById('btnAnalyzeCustomers');
        if (btnAnalyzeCustomers) btnAnalyzeCustomers.addEventListener('click', () => { ensureMonthSelectPopulated(); showAnalysisModal(); });

        const btnAnalyzeProducts = document.getElementById('btnAnalyzeProducts');
        if (btnAnalyzeProducts) btnAnalyzeProducts.addEventListener('click', () => { ensureMonthSelectPopulated(); showProductAnalysisModal(); });

        const btnCloseProductAnalysisModal = document.getElementById('btnCloseProductAnalysisModal');
        const btnCloseProductAnalysisBtn = document.getElementById('btnCloseProductAnalysisBtn');

        if (btnCloseProductAnalysisModal) btnCloseProductAnalysisModal.addEventListener('click', () => { if (productAnalysisModal) productAnalysisModal.style.display = 'none'; });
        if (btnCloseProductAnalysisBtn) btnCloseProductAnalysisBtn.addEventListener('click', () => { if (productAnalysisModal) productAnalysisModal.style.display = 'none'; });

        function ensureMonthSelectPopulated() {
            if (reportMonthSelect && reportMonthSelect.children.length === 0) {
                populateMonthSelect();
            }
        }

        function showProductAnalysisModal() {
            try {
                ensureMonthSelectPopulated();
                const selectedValue = reportMonthSelect ? reportMonthSelect.value : '';
                let year, monthIndex, monthLabel;
                if (selectedValue) {
                    const parts = selectedValue.split('-');
                    year = parseInt(parts[0], 10);
                    monthIndex = parseInt(parts[1], 10) - 1;
                    monthLabel = `${monthIndex + 1}/${year}`;
                } else {
                    const now = new Date();
                    year = now.getFullYear();
                    monthIndex = now.getMonth();
                    monthLabel = `${monthIndex + 1}/${year}`;
                }

                const titleEl = document.getElementById('productAnalysisTitle');
                if (titleEl) titleEl.innerText = `📦 Phân Tích Sản Phẩm & Thể Loại (Tháng ${monthLabel})`;
                const subTitleEl = document.getElementById('productAnalysisSubtitle');
                if (subTitleEl) subTitleEl.innerText = `Thống kê chi tiết doanh thu các mặt hàng bán trong Tháng ${monthLabel}`;

                let start = new Date(year, monthIndex, 1);
                start.setHours(0, 0, 0, 0);
                let end = new Date(year, monthIndex + 1, 0);
                end.setHours(23, 59, 59, 999);

                const categoryStats = {};
                const productStats = {};
                let totalPeriodRevenue = 0;
                let totalOrdersCount = 0;

                customers.forEach(c => {
                    if (Array.isArray(c.history)) {
                        c.history.forEach(tx => {
                            const txDate = new Date(tx.date || tx.timestamp);
                            if (txDate >= start && txDate <= end && tx.amount > 0) {
                                totalOrdersCount++;
                                totalPeriodRevenue += tx.amount;

                                let cat = tx.category || '';
                                let prod = tx.productName || tx.product_name || '';
                                const noteText = tx.note || '';

                                if (!cat && noteText) {
                                    const catMatch = noteText.match(/\[Thể loại:\s*([^\]]+)\]/i);
                                    if (catMatch) cat = catMatch[1].trim();
                                }
                                if (!prod && noteText) {
                                    const prodMatch = noteText.match(/\[Sản phẩm:\s*([^\]]+)\]/i);
                                    if (prodMatch) prod = prodMatch[1].trim();
                                }

                                cat = (cat && cat !== '-') ? cat : 'Chưa xếp loại';
                                prod = (prod && prod !== '-') ? prod : 'Sản phẩm khác / Chưa nhập tên';

                                if (!categoryStats[cat]) categoryStats[cat] = { count: 0, revenue: 0 };
                                categoryStats[cat].count += 1;
                                categoryStats[cat].revenue += tx.amount;

                                if (!productStats[prod]) productStats[prod] = { category: cat, count: 0, revenue: 0 };
                                productStats[prod].count += 1;
                                productStats[prod].revenue += tx.amount;
                            }
                        });
                    }
                });

                const elTotalOrders = document.getElementById('paStatTotalOrders');
                if (elTotalOrders) elTotalOrders.innerText = `${totalOrdersCount} đợt bán`;
                const elTotalRev = document.getElementById('paStatTotalRevenue');
                if (elTotalRev) elTotalRev.innerText = formatCurrency(totalPeriodRevenue);

                const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1].revenue - a[1].revenue);
                const topCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : 'Chưa có';
                const elTopCat = document.getElementById('paStatTopCategory');
                if (elTopCat) elTopCat.innerText = topCategory;

                const catTbody = document.getElementById('paCategoryTableBody');
                if (catTbody) {
                    catTbody.innerHTML = '';
                    if (sortedCategories.length === 0) {
                        catTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có dữ liệu thể loại sản phẩm bán trong tháng này.</td></tr>`;
                    } else {
                        sortedCategories.forEach(([catName, data]) => {
                            const revPct = totalPeriodRevenue > 0 ? ((data.revenue / totalPeriodRevenue) * 100).toFixed(1) : '0.0';
                            const countPct = totalOrdersCount > 0 ? ((data.count / totalOrdersCount) * 100).toFixed(1) : '0.0';

                            const tr = document.createElement('tr');
                            tr.style.borderBottom = '1px solid #f1f5f9';
                            tr.innerHTML = `
                                <td style="padding: 12px 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    <span style="display: inline-block; font-size: 12px; padding: 3px 8px; border-radius: 6px; background: #F3ECE6; color: var(--primary-color); font-weight: 700;">📦 ${catName}</span>
                                </td>
                                <td style="padding: 12px 14px; text-align: center; font-weight: 700; font-size: 14px; color: var(--text-main);">
                                    ${data.count} đợt
                                </td>
                                <td style="padding: 12px 14px; text-align: right; font-weight: 700; font-size: 14px; color: #10b981;">
                                    ${formatCurrency(data.revenue)}
                                </td>
                                <td style="padding: 12px 14px 12px 10px;">
                                    <div style="display: flex; flex-direction: column; gap: 8px; max-width: 240px;">
                                        <div>
                                            <div style="font-size: 11px; font-weight: 600; color: #047857; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                                                <span>Đợt bán:</span>
                                                <strong style="font-size: 12px; color: #047857;">${countPct}%</strong>
                                            </div>
                                            <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; width: 100%;">
                                                <div style="width: ${countPct}%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); border-radius: 3px;"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div style="font-size: 11px; font-weight: 600; color: #6d28d9; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                                                <span>Doanh thu:</span>
                                                <strong style="font-size: 12px; color: #6d28d9;">${revPct}%</strong>
                                            </div>
                                            <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; width: 100%;">
                                                <div style="width: ${revPct}%; height: 100%; background: linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%); border-radius: 3px;"></div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            `;
                            catTbody.appendChild(tr);
                        });
                    }
                }

                const prodTbody = document.getElementById('paProductTableBody');
                if (prodTbody) {
                    prodTbody.innerHTML = '';
                    const sortedProducts = Object.entries(productStats).sort((a, b) => b[1].revenue - a[1].revenue);
                    if (sortedProducts.length === 0) {
                        prodTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có dữ liệu sản phẩm chi tiết trong tháng này.</td></tr>`;
                    } else {
                        sortedProducts.forEach(([prodName, data], index) => {
                            const prodRevPct = totalPeriodRevenue > 0 ? ((data.revenue / totalPeriodRevenue) * 100).toFixed(1) : '0.0';
                            const tr = document.createElement('tr');
                            tr.style.borderBottom = '1px solid #f1f5f9';
                            let rankBadge = `<span style="font-weight: 700; color: var(--text-muted);">${index + 1}</span>`;
                            if (index === 0) rankBadge = `<span style="display: inline-block; width: 22px; height: 22px; background: #f59e0b; color: white; border-radius: 50%; text-align: center; line-height: 22px; font-weight: bold; font-size: 12px;">1</span>`;
                            else if (index === 1) rankBadge = `<span style="display: inline-block; width: 22px; height: 22px; background: #94a3b8; color: white; border-radius: 50%; text-align: center; line-height: 22px; font-weight: bold; font-size: 12px;">2</span>`;
                            else if (index === 2) rankBadge = `<span style="display: inline-block; width: 22px; height: 22px; background: #b45309; color: white; border-radius: 50%; text-align: center; line-height: 22px; font-weight: bold; font-size: 12px;">3</span>`;

                            tr.innerHTML = `
                                <td style="padding: 10px 6px; text-align: center;">${rankBadge}</td>
                                <td style="padding: 10px 8px; font-weight: 600; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🏷️ ${prodName}</td>
                                <td style="padding: 10px 8px;"><span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #F3ECE6; color: var(--primary-color); font-weight: 600;">${data.category}</span></td>
                                <td style="padding: 10px 8px; text-align: left; white-space: nowrap;">
                                    <div style="font-weight: 800; color: #10b981; font-size: 14px;">${formatCurrency(data.revenue)}</div>
                                    <small style="color: #8b5cf6; font-size: 11px; font-weight: 600;">(${prodRevPct}% cả tháng)</small>
                                </td>
                            `;
                            prodTbody.appendChild(tr);
                        });
                    }
                }
            } catch(e) {
                console.error("Lỗi showProductAnalysisModal:", e);
            } finally {
                closeAllModals();
                const pModal = document.getElementById('productAnalysisModal');
                if (pModal) pModal.style.display = 'flex';
            }
        }
        document.getElementById('btnConfirmWarning').addEventListener('click', function() { if (pendingActionData) proceedWithSave(pendingActionData.data, pendingActionData.isUpdating); warningModal.style.display = 'none'; pendingActionData = null; });
        document.getElementById('btnCancelWarning').addEventListener('click', function() { warningModal.style.display = 'none'; pendingActionData = null; });
        document.getElementById('btnDelete').addEventListener('click', function() { const id = idInput.value.trim(); customerToDelete = id; deleteModalMessage.innerHTML = `Bạn có chắc chắn muốn xóa khách hàng <strong>"${id}"</strong> không?`; deleteModal.style.display = 'flex'; });
        
        document.getElementById('btnConfirmDelete').addEventListener('click', async function() { 
            if (customerToDelete) { 
                document.getElementById('btnConfirmDelete').innerText = 'Đang xóa...';
                document.getElementById('btnConfirmDelete').disabled = true;
                const { error } = await supabaseClient.from('Quan ly ban hang').delete().eq('customer_id', customerToDelete);
                document.getElementById('btnConfirmDelete').innerText = 'Xóa';
                document.getElementById('btnConfirmDelete').disabled = false;
                
                if (error) alert("Không thể xóa dòng dữ liệu: " + error.message);
                else { await fetchCustomers(); toggleEditMode(false); closeCustomerFormModal(); }
            } 
            deleteModal.style.display = 'none'; 
        });

        document.getElementById('btnCancelDelete').addEventListener('click', function() { deleteModal.style.display = 'none'; });
        if (btnCancelEdit) btnCancelEdit.addEventListener('click', function() { closeCustomerFormModal(); toggleEditMode(false); });
        searchInput.addEventListener('input', () => { currentPage = 1; renderTable(); });
        if (filterClassification) filterClassification.addEventListener('change', () => { currentPage = 1; renderTable(); });

        document.getElementById('btnConfirmModal').addEventListener('click', async function() {
            const index = customers.findIndex(c => String(c.customerId).toLowerCase() === String(pendingCustomerData.customerId).toLowerCase());
            if (index !== -1) { 
                const oldData = customers[index];
                const history = Array.isArray(oldData.history) ? [...oldData.history] : [];
                
                let changes = [];
                if ((pendingCustomerData.companyName || '').trim() !== (oldData.companyName || '').trim()) changes.push(`Tên công ty`);
                if ((pendingCustomerData.taxId || '').trim() !== (oldData.taxId || '').trim()) changes.push(`Mã số thuế`);
                if (pendingCustomerData.classification !== oldData.classification) changes.push(`Phân loại (${oldData.classification || 'Chưa phân loại'} -> ${pendingCustomerData.classification || 'Chưa phân loại'})`);
                if ((pendingCustomerData.contactName || '').trim() !== (oldData.contactName || '').trim()) changes.push(`Người liên hệ`);
                if ((pendingCustomerData.phone || '').trim() !== (oldData.phone || '').trim()) changes.push(`Số điện thoại`);
                if (pendingCustomerData.category !== oldData.category) changes.push(`Thể loại (${oldData.category || '-'} -> ${pendingCustomerData.category || '-'})`);
                if ((pendingCustomerData.productName || '').trim() !== (oldData.productName || '').trim()) changes.push(`Sản phẩm (${oldData.productName || '-'} -> ${pendingCustomerData.productName || '-'})`);
                if ((pendingCustomerData.notes || '').trim() !== (oldData.notes || '').trim()) changes.push(`Ghi chú`);
                
                const salesDiff = (Number(pendingCustomerData.sales) || 0) - (Number(oldData.sales) || 0);
                if (salesDiff !== 0) {
                    changes.push(`Doanh số (${salesDiff > 0 ? '+' : ''}${formatCurrency(salesDiff)})`);
                }

                if (changes.length > 0) {
                    history.push({
                        timestamp: new Date().toISOString(),
                        date: new Date().toISOString(),
                        user: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
                        updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
                        amount: salesDiff,
                        category: pendingCustomerData.category || '',
                        productName: pendingCustomerData.productName || '',
                        note: `Ghi đè: ${changes.join(', ')}`
                    });
                }
                
                pendingCustomerData.history = history;
                pendingCustomerData.lastUpdated = new Date().toISOString();
                
                const btn = document.getElementById('btnConfirmModal');
                btn.innerText = 'Đang ghi đè...'; btn.disabled = true;
                
                const payload = mapToSupabase(pendingCustomerData);
                const { error } = await supabaseClient.from('Quan ly ban hang').update(payload).eq('customer_id', pendingCustomerData.customerId);
                
                btn.innerText = 'Có, Cập nhật'; btn.disabled = false;
                if (error) alert("Gặp lỗi khi ghi đè dữ liệu: " + error.message);
                else { await fetchCustomers(); switchTab('table'); }
            }
            modal.style.display = 'none'; toggleEditMode(false);
        });
        document.getElementById('btnCancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        
        function getFilteredAndSortedData() {
            const query = searchInput.value.toLowerCase(); const filterClassVal = filterClassification ? filterClassification.value : '';
            let filtered = customers.filter(c => {
                const matchSearch = String(c.customerId || '').toLowerCase().includes(query) || (c.companyName && String(c.companyName).toLowerCase().includes(query)) ||
                    (c.taxId && String(c.taxId).toLowerCase().includes(query)) || (c.contactName && String(c.contactName).toLowerCase().includes(query)) ||
                    (c.phone && String(c.phone).includes(query)) || (c.classification && String(c.classification).toLowerCase().includes(query));
                const matchClass = filterClassVal === '' || c.classification === filterClassVal;
                return matchSearch && matchClass;
            });
            filtered.sort((a, b) => b.sales - a.sales);
            return filtered;
        }

        document.getElementById('btnExportExcel').addEventListener('click', function() {
            const data = getFilteredAndSortedData(); if (data.length === 0) return;
            const exportData = data.map((c, index) => ({
                "STT": index + 1, "Mã KH": c.customerId || "", "Phân loại": c.classification || "",
                "MST": c.taxId || "", "Tên Công ty": c.companyName || "", "Người liên hệ": c.contactName || "",
                "Số điện thoại": formatPhoneNumber(c.phone) === '-' ? '' : formatPhoneNumber(c.phone), "Doanh số KH (VNĐ)": c.sales || 0, "Ngày cập nhật": formatDateTime(c.lastUpdated), "Ghi chú": c.notes || ""
            }));
            const ws = XLSX.utils.json_to_sheet(exportData); const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Doanh_So_Khach_Hang"); XLSX.writeFile(wb, "Bang_Xep_Hang_Doanh_So.xlsx");
        });

        document.getElementById('btnExportPDF').addEventListener('click', function() {
            const data = getFilteredAndSortedData(); if (data.length === 0) return;
            const tableBodyData = [];
            tableBodyData.push([{ text: 'STT', style: 'tableHeader', alignment: 'center' }, { text: 'Mã KH', style: 'tableHeader' }, { text: 'MST', style: 'tableHeader' }, { text: 'Tên Công ty', style: 'tableHeader' }, { text: 'Người LH', style: 'tableHeader' }, { text: 'SĐT', style: 'tableHeader' }, { text: 'Doanh số (VNĐ)', style: 'tableHeader', alignment: 'right' }, { text: 'Ngày cập nhật', style: 'tableHeader' }, { text: 'Ghi chú', style: 'tableHeader' }]);
            data.forEach((c, index) => {
                let salesColor = c.sales >= 0 ? '#10b981' : '#ef4444'; let maKhColor = (c.classification && classificationColors[c.classification]) ? classificationColors[c.classification] : '#2563eb';
                tableBodyData.push([
                    { text: (index + 1).toString(), alignment: 'center' }, { text: c.customerId || '-', color: maKhColor, bold: true },
                    { text: c.taxId || '-' }, { text: c.companyName || '-', bold: true }, { text: c.contactName || '-' }, { text: formatPhoneNumber(c.phone) },
                    { text: formatCurrency(c.sales || 0), alignment: 'right', color: salesColor, bold: true },
                    { text: formatDateTime(c.lastUpdated), fontSize: 9 }, { text: c.notes || '-' }
                ]);
            });
            const docDefinition = {
                pageOrientation: 'landscape', pageSize: 'A4',
                content: [ { text: 'Bảng Xếp hạng Doanh số Khách hàng', style: 'header' }, { table: { headerRows: 1, widths: ['4%', '11%', '9%', '21%', '11%', '10%', '13%', '12%', '9%'], body: tableBodyData }, layout: { hLineWidth: function (i) { return 1; }, vLineWidth: function (i) { return 1; }, hLineColor: function (i) { return '#e2e8f0'; }, vLineColor: function (i) { return '#e2e8f0'; }, paddingLeft: function(i) { return 6; }, paddingRight: function(i) { return 6; }, paddingTop: function(i) { return 8; }, paddingBottom: function(i) { return 8; } } } ],
                styles: { header: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 15], color: '#2563eb' }, tableHeader: { bold: true, fontSize: 11, color: '#475569', fillColor: '#f8fafc' } }, defaultStyle: { fontSize: 10 }
            };
            pdfMake.createPdf(docDefinition).download('Bang_Xep_Hang_Doanh_So.pdf');
        });

        const btnCloseReport = document.getElementById('btnCloseReport');
        if (btnCloseReport) {
            btnCloseReport.addEventListener('click', () => { 
                const rm = document.getElementById('reportModal'); 
                if (rm) {
                    rm.classList.remove('show');
                    setTimeout(() => {
                        rm.style.display = 'none';
                    }, 200);
                }
            });
        }
        function populateMonthSelect() {
            reportMonthSelect.innerHTML = ''; const now = new Date();
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const month = d.getMonth() + 1; const year = d.getFullYear(); const option = document.createElement('option');
                option.value = `${year}-${month}`; option.text = i === 0 ? `Tháng ${month}/${year} (Tháng này)` : `Tháng ${month}/${year}`;
                reportMonthSelect.appendChild(option);
            }
        }
        function showRevenueReport() {
            const selectedValue = reportMonthSelect.value; let year, monthIndex, monthLabel;
            if (selectedValue) { const parts = selectedValue.split('-'); year = parseInt(parts[0], 10); monthIndex = parseInt(parts[1], 10) - 1; monthLabel = `${monthIndex + 1}/${year}`; } 
            else { const now = new Date(); year = now.getFullYear(); monthIndex = now.getMonth(); monthLabel = `${monthIndex + 1}/${year}`; }
            let start = new Date(year, monthIndex, 1); start.setHours(0,0,0,0); let end = new Date(year, monthIndex + 1, 0); end.setHours(23, 59, 59, 999);
            let totalRevenuePeriod = 0; let transactionsInPeriod = [];
            customers.forEach(c => {
                if (c.history && c.history.length > 0) {
                    c.history.forEach(tx => {
                        const txDate = new Date(tx.date);
                        if (txDate >= start && txDate <= end && tx.amount !== 0) transactionsInPeriod.push({ customer: c, tx: tx, date: txDate });
                    });
                }
            });
            transactionsInPeriod.sort((a, b) => b.date - a.date);
            const reportTableBody = document.getElementById('reportTableBody'); reportTableBody.innerHTML = '';
            if (transactionsInPeriod.length === 0) {
                reportTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64748b;">Không có giao dịch/biến động doanh thu nào phát sinh trong <strong>Tháng ${monthLabel}</strong>.</td></tr>`;
                document.getElementById('reportTotalRevenue').innerText = "0 đ"; document.getElementById('reportTotalRevenue').style.color = "#64748b";
            } else {
                transactionsInPeriod.forEach(item => {
                    const c = item.customer; const tx = item.tx;
                    const formattedTime = item.date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    totalRevenuePeriod += tx.amount; let amountColor = tx.amount > 0 ? '#10b981' : '#ef4444';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${formattedTime}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: var(--primary-color);">${c.customerId || '-'}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${c.companyName || '-'}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: ${amountColor}; font-weight: bold;">${formatCurrency(tx.amount)}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${tx.note || '-'}</td>`;
                    reportTableBody.appendChild(tr);
                });
                document.getElementById('reportTotalRevenue').innerText = formatCurrency(totalRevenuePeriod); document.getElementById('reportTotalRevenue').style.color = totalRevenuePeriod >= 0 ? "#10b981" : "#ef4444";
            }
            closeAllModals();
            const reportModalEl = document.getElementById('reportModal');
            if (reportModalEl) {
                reportModalEl.style.display = 'flex';
                reportModalEl.classList.add('show');
            }
        }
        reportMonthSelect.addEventListener('change', showRevenueReport);
        document.getElementById('btnReportMonth').addEventListener('click', () => { populateMonthSelect(); showRevenueReport(); });

        let chartClassificationInstance = null;
        let chartTopCustomersInstance = null;
        let chartRevenueTrendInstance = null;

        function showAnalysisModal() {
            ensureMonthSelectPopulated();
            const selectedValue = reportMonthSelect ? reportMonthSelect.value : '';
            let year, monthIndex, monthLabel;
            if (selectedValue) {
                const parts = selectedValue.split('-');
                year = parseInt(parts[0], 10);
                monthIndex = parseInt(parts[1], 10) - 1;
                monthLabel = `${monthIndex + 1}/${year}`;
            } else {
                const now = new Date();
                year = now.getFullYear();
                monthIndex = now.getMonth();
                monthLabel = `${monthIndex + 1}/${year}`;
            }

            document.getElementById('analysisTitle').innerText = `Phân Tích Doanh Thu & Khách Hàng - Tháng ${monthLabel}`;

            let start = new Date(year, monthIndex, 1);
            start.setHours(0,0,0,0);
            let end = new Date(year, monthIndex + 1, 0);
            end.setHours(23, 59, 59, 999);

            let totalRevenueMonth = 0;
            let txCountMonth = 0;
            const customerRevenueMap = {};
            const classCountMap = {
                "Khách mới": 0,
                "Thường xuyên": 0,
                "Không thường xuyên": 0,
                "Chưa liên hệ được": 0,
                "Không nhu cầu": 0,
                "Chưa phân loại": 0
            };

            // Xác định khoảng thời gian tháng trước để so sánh tăng trưởng/sụt giảm
            let prevStart = new Date(year, monthIndex - 1, 1);
            prevStart.setHours(0,0,0,0);
            let prevEnd = new Date(year, monthIndex, 0);
            prevEnd.setHours(23, 59, 59, 999);

            let newCustCount = 0;
            let returningCustCount = 0;
            let newCustRevenue = 0;
            let returningCustRevenue = 0;
            let totalActiveCust = 0;

            customers.forEach(c => {
                let customerHasTxInMonth = false;
                let customerRevenueInMonth = 0;

                if (c.history && c.history.length > 0) {
                    c.history.forEach(tx => {
                        const txDate = new Date(tx.date);
                        if (txDate >= start && txDate <= end && tx.amount !== 0) {
                            totalRevenueMonth += tx.amount;
                            txCountMonth++;
                            customerRevenueInMonth += tx.amount;
                            customerHasTxInMonth = true;
                        }
                    });
                }

                if (customerHasTxInMonth) {
                    totalActiveCust++;
                    
                    // Xác định khách mới trong tháng (giao dịch đầu tiên nằm trong tháng được chọn)
                    const dates = c.history.map(tx => new Date(tx.date).getTime());
                    const minDate = new Date(Math.min(...dates));
                    const isNewThisMonth = minDate >= start && minDate <= end;
                    
                    if (isNewThisMonth) {
                        newCustCount++;
                        newCustRevenue += customerRevenueInMonth;
                    } else {
                        returningCustCount++;
                        returningCustRevenue += customerRevenueInMonth;
                    }

                    customerRevenueMap[c.customerId] = {
                        customerId: c.customerId,
                        companyName: c.companyName || '-',
                        classification: c.classification || 'Chưa phân loại',
                        amount: customerRevenueInMonth
                    };

                    const classification = c.classification || 'Chưa phân loại';
                    if (classCountMap.hasOwnProperty(classification)) {
                        classCountMap[classification]++;
                    } else {
                        classCountMap["Chưa phân loại"]++;
                    }
                }
            });

            // Tính toán so sánh với tháng trước
            let prevRevenueMonth = 0;
            customers.forEach(c => {
                if (c.history && c.history.length > 0) {
                    c.history.forEach(tx => {
                        const txDate = new Date(tx.date);
                        if (txDate >= prevStart && txDate <= prevEnd && tx.amount !== 0) {
                            prevRevenueMonth += tx.amount;
                        }
                    });
                }
            });

            const revDiff = totalRevenueMonth - prevRevenueMonth;
            let revPctStr = '';
            let compareColor = 'var(--text-muted)';
            if (prevRevenueMonth > 0) {
                const pct = Math.round((revDiff / prevRevenueMonth) * 100);
                const sign = pct >= 0 ? '+' : '';
                revPctStr = `${sign}${pct}% so với tháng trước (${pct >= 0 ? '+' : ''}${formatCurrency(revDiff)})`;
                compareColor = pct >= 0 ? '#10b981' : '#ef4444';
            } else if (totalRevenueMonth > 0) {
                revPctStr = `Mới (+${formatCurrency(totalRevenueMonth)})`;
                compareColor = '#10b981';
            } else {
                revPctStr = `0% so với tháng trước`;
            }

            // Tính toán tổng doanh thu của toàn bộ hệ thống
            const totalWebSales = customers.reduce((sum, c) => sum + (c.sales || 0), 0);

            // Tính toán tỷ lệ phần trăm khách mới/cũ
            const newCustRatio = totalActiveCust > 0 ? Math.round((newCustCount / totalActiveCust) * 100) : 0;
            const newCustRevenueRatio = totalRevenueMonth > 0 ? Math.round((newCustRevenue / totalRevenueMonth) * 100) : 0;
            
            const returnCustRatio = totalActiveCust > 0 ? Math.round((returningCustCount / totalActiveCust) * 100) : 0;
            const returnCustRevenueRatio = totalRevenueMonth > 0 ? Math.round((returningCustRevenue / totalRevenueMonth) * 100) : 0;

            // Cập nhật thẻ chỉ số KPI chính
            document.getElementById('kpiRevenueAllTime').innerText = formatCurrency(totalWebSales);
            document.getElementById('kpiRevenue').innerText = formatCurrency(totalRevenueMonth);
            document.getElementById('kpiRevenueCompare').innerText = revPctStr;
            document.getElementById('kpiRevenueCompare').style.color = compareColor;
            document.getElementById('kpiTxCount').innerText = txCountMonth;
            document.getElementById('kpiNewCustomers').innerText = newCustCount;

            // Cập nhật các thẻ tỷ lệ mới/cũ
            document.getElementById('kpiNewCustRatio').innerHTML = `${newCustRatio}% <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">${newCustCount}/${totalActiveCust} KH</span>`;
            document.getElementById('kpiNewCustRevenueRatio').innerText = `Đóng góp: ${newCustRevenueRatio}% doanh số (${formatCurrency(newCustRevenue)})`;
            
            document.getElementById('kpiReturnCustRatio').innerHTML = `${returnCustRatio}% <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">${returningCustCount}/${totalActiveCust} KH</span>`;
            document.getElementById('kpiReturnCustRevenueRatio').innerText = `Đóng góp: ${returnCustRevenueRatio}% doanh số (${formatCurrency(returningCustRevenue)})`;

            // Tính xu hướng doanh thu từ tháng 1 đến tháng 12 của năm được chọn (ví dụ năm 2026)
            const last12Months = [];
            for (let i = 0; i < 12; i++) {
                last12Months.push({
                    year: year,
                    month: i + 1,
                    label: `T${String(i + 1).padStart(2, '0')}-${year}`
                });
            }

            const monthlyRevenues = last12Months.map(m => {
                const mStart = new Date(m.year, m.month - 1, 1);
                mStart.setHours(0,0,0,0);
                const mEnd = new Date(m.year, m.month, 0);
                mEnd.setHours(23, 59, 59, 999);

                let rev = 0;
                customers.forEach(c => {
                    if (c.history && c.history.length > 0) {
                        c.history.forEach(tx => {
                            const txDate = new Date(tx.date);
                            if (txDate >= mStart && txDate <= mEnd && tx.amount !== 0) {
                                rev += tx.amount;
                            }
                        });
                    }
                });
                return rev;
            });

            // Populate table details
            const analysisTableBody = document.getElementById('analysisTableBody');
            analysisTableBody.innerHTML = '';
            
            const activeCustomersList = Object.values(customerRevenueMap).sort((a, b) => b.amount - a.amount);
            if (activeCustomersList.length === 0) {
                analysisTableBody.innerHTML = `<tr><td colspan="2" class="text-center" style="color: var(--text-muted); padding: 15px;">Không có dữ liệu giao dịch trong tháng này.</td></tr>`;
            } else {
                activeCustomersList.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #e2e8f0';
                    tr.innerHTML = `
                        <td style="width: 75% !important; max-width: 75% !important; padding: 10px 8px; font-weight: bold; color: var(--primary-color); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.customerId}">${item.customerId}</td>
                        <td style="width: 25% !important; max-width: 25% !important; padding: 10px 8px; text-align: right; font-weight: bold; color: ${item.amount > 0 ? '#10b981' : '#ef4444'}; white-space: nowrap;">${formatCurrency(item.amount)}</td>
                    `;
                    analysisTableBody.appendChild(tr);
                });
            }

            closeAllModals();
            const aModal = document.getElementById('analysisModal');
            if (aModal) aModal.style.display = 'flex';

            // Create charts safely
            try {
                createAnalysisCharts(classCountMap, activeCustomersList.slice(0, 5), last12Months.map(m => m.label), monthlyRevenues);
            } catch (err) {
                console.error("Lỗi tạo biểu đồ phân tích:", err);
            }
        }

        function createAnalysisCharts(classCounts, topCustomers, trendLabels, trendData) {
            // Destroy previous instances
            if (chartClassificationInstance) chartClassificationInstance.destroy();
            if (chartTopCustomersInstance) chartTopCustomersInstance.destroy();
            if (chartRevenueTrendInstance) chartRevenueTrendInstance.destroy();

            // 1. Classification doughnut chart
            const ctxClass = document.getElementById('chartClassification').getContext('2d');
            const classLabels = Object.keys(classCounts).filter(k => classCounts[k] > 0);
            const classData = classLabels.map(k => classCounts[k]);
            const classColors = classLabels.map(k => classificationColors[k] || '#94a3b8');

            if (classData.length === 0) {
                classLabels.push("Không có dữ liệu");
                classData.push(1);
                classColors.push("#cbd5e1");
            }

            chartClassificationInstance = new Chart(ctxClass, {
                type: 'doughnut',
                data: {
                    labels: classLabels,
                    datasets: [{
                        data: classData,
                        backgroundColor: classColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });

            // 2. Top customers bar chart
            const ctxTop = document.getElementById('chartTopCustomers').getContext('2d');
            const topLabels = topCustomers.map(c => c.customerId);
            const topData = topCustomers.map(c => c.amount);

            chartTopCustomersInstance = new Chart(ctxTop, {
                type: 'bar',
                data: {
                    labels: topLabels,
                    datasets: [{
                        label: 'Doanh thu tăng (VNĐ)',
                        data: topData,
                        backgroundColor: '#3b82f6',
                        borderColor: '#2563eb',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1e6) return (value / 1e6) + ' Tr';
                                    return value.toLocaleString('vi-VN');
                                }
                            }
                        }
                    }
                }
            });

            // 3. Revenue Trend line chart
            const ctxTrend = document.getElementById('chartRevenueTrend').getContext('2d');
            chartRevenueTrendInstance = new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: trendLabels,
                    datasets: [{
                        label: 'Doanh thu tháng (VNĐ)',
                        data: trendData,
                        borderColor: '#ea580c',
                        backgroundColor: 'rgba(234, 88, 12, 0.05)',
                        borderWidth: 3,
                        pointBackgroundColor: '#2563eb',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.35,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 25
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Doanh thu: ${formatCurrency(context.raw)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grace: '20%',
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1e6) return (value / 1e6).toFixed(1) + ' Tr';
                                    return value.toLocaleString('vi-VN') + ' đ';
                                }
                            },
                            grid: {
                                color: '#f1f5f9'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'customDataLabels',
                    afterDatasetsDraw: function(chart) {
                        const ctx = chart.ctx;
                        chart.data.datasets.forEach((dataset, datasetIndex) => {
                            const meta = chart.getDatasetMeta(datasetIndex);
                            meta.data.forEach((point, index) => {
                                const dataVal = dataset.data[index];
                                const label = dataVal === 0 ? '0 đ' : formatCurrency(dataVal);
                                
                                ctx.font = 'bold 11px sans-serif';
                                const textWidth = ctx.measureText(label).width;
                                const textHeight = 12;
                                
                                const x = point.x;
                                const y = point.y - 18;
                                
                                ctx.fillStyle = '#fef08a';
                                ctx.strokeStyle = '#facc15';
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                if (ctx.roundRect) {
                                    ctx.roundRect(x - textWidth/2 - 4, y - textHeight - 2, textWidth + 8, textHeight + 6, 3);
                                } else {
                                    ctx.rect(x - textWidth/2 - 4, y - textHeight - 2, textWidth + 8, textHeight + 6);
                                }
                                ctx.fill();
                                ctx.stroke();
                                
                                ctx.fillStyle = '#854d0e';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(label, x, y - textHeight/2 + 1);
                            });
                        });
                    }
                }]
            });
        }

        const btnImportExcel = document.getElementById('btnImportExcel');
        const excelImportModal = document.getElementById('excelImportModal');
        const excelImportMonth = document.getElementById('excelImportMonth');
        const btnCancelExcelImport = document.getElementById('btnCancelExcelImport');
        const btnConfirmExcelImport = document.getElementById('btnConfirmExcelImport');
        
        let pendingExcelData = null;

        btnImportExcel.addEventListener('click', function() { fileInputExcel.value = null; fileInputExcel.click(); });

        fileInputExcel.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheetName = workbook.SheetNames[0];
                    pendingExcelData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" }); 
                    
                    // Hiển thị modal chọn tháng
                    populateExcelImportMonths();
                    excelImportModal.style.display = 'flex';
                } catch (error) {
                    alert("Không thể đọc tệp Excel. Vui lòng kiểm tra lại cấu trúc file!");
                }
            };
            reader.readAsArrayBuffer(file);
        });

        function populateExcelImportMonths() {
            if (!excelImportMonth) return;
            excelImportMonth.innerHTML = '';
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const month = d.getMonth() + 1;
                const year = d.getFullYear();
                const option = document.createElement('option');
                option.value = `${year}-${month}`;
                option.text = i === 0 ? `Tháng ${month}/${year} (Tháng này)` : `Tháng ${month}/${year}`;
                excelImportMonth.appendChild(option);
            }
        }

        if (btnCancelExcelImport) {
            btnCancelExcelImport.addEventListener('click', function() {
                excelImportModal.style.display = 'none';
                pendingExcelData = null;
            });
        }

        if (btnConfirmExcelImport) {
            btnConfirmExcelImport.addEventListener('click', async function() {
                if (!pendingExcelData) return;
                
                const selectedValue = excelImportMonth.value;
                const parts = selectedValue.split('-');
                const selectedYear = parseInt(parts[0], 10);
                const selectedMonth = parseInt(parts[1], 10); // 1-indexed

                // Ngày ghi nhận (chọn ngày 28 của tháng đó để an toàn và tránh múi giờ lệch)
                const targetDate = new Date(selectedYear, selectedMonth - 1, 28, 12, 0, 0).toISOString();
                const nowStr = new Date().toISOString();

                excelImportModal.style.display = 'none';
                btnImportExcel.innerText = "Đang xử lý...";
                btnImportExcel.disabled = true;

                try {
                    let importedCount = 0;
                    let updatedCount = 0;
                    const payloadsToUpsert = [];

                    pendingExcelData.forEach(row => {
                        const normRow = {};
                        for (let k in row) if (row.hasOwnProperty(k)) normRow[k.trim().toLowerCase()] = row[k];
                        const custId = String(normRow["mã kh"] || normRow["mã khách hàng"] || normRow["customerid"] || normRow["mã"] || "").trim();
                        if (!custId) return;
                        
                        let salesVal = normRow["doanh số kh (vnđ)"] || normRow["doanh số (vnđ)"] || normRow["doanh số"] || normRow["sales"] || 0;
                        if (typeof salesVal === 'string') salesVal = Number(salesVal.replace(/[,.]/g, '')) || 0;

                        const newCustomer = {
                            customerId: custId,
                            taxId: String(normRow["mst"] || normRow["mã số thuế"] || normRow["taxid"] || "").trim(),
                            companyName: String(normRow["tên công ty"] || normRow["công ty"] || normRow["companyname"] || "").trim(),
                            classification: String(normRow["phân loại"] || normRow["phân loại khách hàng"] || normRow["classification"] || "").trim(),
                            contactName: String(normRow["người liên hệ"] || normRow["người lh"] || normRow["contactname"] || "").trim(),
                            phone: String(normRow["số điện thoại"] || normRow["sđt"] || normRow["phone"] || "").trim(),
                            sales: Number(salesVal) || 0,
                            notes: String(normRow["ghi chú"] || normRow["notes"] || "").trim(),
                            lastUpdated: nowStr
                        };

                        const existingIndex = customers.findIndex(c => String(c.customerId).toLowerCase() === custId.toLowerCase());
                        if (existingIndex !== -1) {
                            // Cập nhật khách hàng cũ: dịch chuyển các bản ghi Excel cũ được ghi trong tháng này về tháng được chọn
                            const currentMonth = new Date().getMonth();
                            const currentYear = new Date().getFullYear();
                            
                            newCustomer.history = (customers[existingIndex].history || []).map(tx => {
                                if (tx.note && tx.note.includes("Excel")) {
                                    const txDate = new Date(tx.date);
                                    // Nếu giao dịch được ghi trong tháng hiện tại (do import nhầm vừa rồi) -> dịch chuyển về tháng được chọn
                                    if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
                                        tx.date = targetDate;
                                    }
                                }
                                return tx;
                            });

                            const diff = newCustomer.sales - (customers[existingIndex].sales || 0);
                            if (diff !== 0) {
                                newCustomer.history.push({ date: targetDate, amount: diff, note: 'Cập nhật qua Excel', updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống' });
                            }
                            updatedCount++;
                        } else {
                            // Khách hàng mới: tạo lịch sử thuộc tháng được chọn
                            newCustomer.history = [{ date: targetDate, amount: newCustomer.sales, note: 'Thêm mới qua Excel', updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống' }];
                            importedCount++;
                        }
                        payloadsToUpsert.push(mapToSupabase(newCustomer));
                    });

                    if (payloadsToUpsert.length === 0) {
                        notificationTitle.innerText = "Lỗi Cấu Trúc File";
                        notificationTitle.style.color = "#ef4444";
                        notificationMessage.innerHTML = "Không thể đọc dữ liệu! Hãy đảm bảo file Excel của bạn có chứa cột tiêu đề <strong>Mã KH</strong>.";
                        notificationModal.style.display = 'flex';
                    } else {
                        const { error } = await supabaseClient.from('Quan ly ban hang').upsert(payloadsToUpsert, { onConflict: 'customer_id' });
                        if (error) {
                            alert("Gặp sự cố khi đồng bộ lên Supabase: " + error.message);
                        } else {
                            await fetchCustomers();
                            notificationTitle.innerText = "Nhập Excel Thành Công!";
                            notificationTitle.style.color = "#10b981";
                            notificationMessage.innerHTML = `Đã thêm mới: <strong>${importedCount}</strong> khách hàng.<br>Đã cập nhật: <strong>${updatedCount}</strong> khách hàng.<br>Dữ liệu lịch sử đã được ghi nhận vào: <strong>Tháng ${selectedMonth}/${selectedYear}</strong>.`;
                            notificationModal.style.display = 'flex';
                        }
                    }
                } catch (error) {
                    console.error(error);
                    alert("Đã xảy ra lỗi trong quá trình xử lý dữ liệu nhập.");
                } finally {
                    btnImportExcel.innerText = "Nhập Excel";
                    btnImportExcel.disabled = false;
                    pendingExcelData = null;
                }
            });
        }

        // Bắt đầu chạy
        initAuthListener();
