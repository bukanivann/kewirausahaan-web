/* ==========================================================================
   KETHAI & CO - JAVASCRIPT APPLICATION (INTERACTIVE GALLERY & CONFIGURATOR)
   Spesialis Ketan Susu Nusantara Modern dengan Galeri Dinamis & Add-on
   ========================================================================== */

// --- Global Application State ---
const state = {
    // Produk Utama: Ketan Susu Original (Rp 7.000)
    product: {
        id: 'original',
        name: 'Ketan Susu Original',
        basePrice: 7000,
        qty: 1,
        selectedAddons: []
    },

    // Master Add-on / Topping Tambahan (Satuan 2rb, Paket Lengkap 5rb)
    availableAddons: [
        {
            id: 'extra_mangga',
            name: 'Topping Mangga Segar',
            price: 2000,
            imageKey: 'mangga',
            icon: 'fa-solid fa-lemon',
            iconBg: '#FEF3C7',
            iconColor: '#D97706',
            label: 'Mangga Harum Manis (+Rp 2.000)'
        },
        {
            id: 'extra_stroberi',
            name: 'Topping Stroberi Segar',
            price: 2000,
            imageKey: 'stroberi',
            icon: 'fa-solid fa-apple-whole',
            iconBg: '#FFE4E6',
            iconColor: '#E11D48',
            label: 'Stroberi Segar Asli (+Rp 2.000)'
        },
        {
            id: 'combo_lengkap',
            name: 'Paket Topping Lengkap (Mangga, Stroberi & Keju)',
            price: 5000,
            imageKey: 'lengkap',
            icon: 'fa-solid fa-crown',
            iconBg: '#F3E8FF',
            iconColor: '#9333EA',
            label: 'Combo Lengkap Mangga, Stroberi & Keju (+Rp 5.000)'
        },
        {
            id: 'extra_keju',
            name: 'Extra Keju Parut Gurih',
            price: 2000,
            imageKey: null,
            icon: 'fa-solid fa-cheese',
            iconBg: '#FEF3C7',
            iconColor: '#D97706',
            label: 'Double Keju Parut (+Rp 2.000)'
        }
    ],

    // Database Gambar Galeri Detail
    galleryImages: {
        original: {
            src: 'images/ketan_original.jpg',
            label: 'Ketan Susu Original'
        },
        mangga: {
            src: 'images/ketan_mangga.jpg',
            label: 'Topping Mangga Harum Manis'
        },
        stroberi: {
            src: 'images/ketan_stroberi.jpg',
            label: 'Topping Stroberi Segar Asli'
        },
        lengkap: {
            src: 'images/ketan_lengkap.jpg',
            label: 'Topping Lengkap Mangga, Stroberi & Keju'
        }
    },

    currentGalleryKey: 'original',
    cart: [],
    // Master WhatsApp Admin yang Berjaga
    admins: [
        {
            id: 'admin1',
            name: 'Malik',
            fullName: 'Admin 1 (Malik)',
            phone: '+62 813-1167-0557',
            waNumber: '6281311670557'
        },
        {
            id: 'admin2',
            name: 'Rooben',
            fullName: 'Admin 2 (Rooben)',
            phone: '+62 852-7775-8520',
            waNumber: '6285277758520'
        }
    ],
    selectedAdminId: 'admin1',
    targetWA: '6281311670557', // Default ke Admin 1 Malik
    paymentMethod: 'qris',     // 'qris' atau 'cash'
    sheetsEndpointURL: 'https://script.google.com/macros/s/AKfycbxPUBjw8j-ih8P-mgLxIKNFBjR2Fq17h8knWkyGNHm72lqlD6sM7gnWz-h2h0b5bR-7/exec', // Webhook URL Google Spreadsheet

    // State Verifikasi QRIS Anti-Pembeli Fiktif
    qrisProofDataUrl: null,
    qrisProofFilename: '',
    qrisTimerInterval: null,
    qrisTimeLeft: 900,         // 15 menit countdown
    lastVerifiedOrder: null,
    ordersSortDirection: 'asc' // 'asc' = urutan dari atas (No. 1, 2, 3...), 'desc' = terbaru di atas
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    selectAdmin('admin1');
    updateConfiguratorUI();
    updateCartUI();
    selectPaymentMethod('qris');
    updateWAPreview();
    setupProofDropzone();

    // Cegah browser membuka file secara default saat ada file diseret ke luar dropzone
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);
});

// ==========================================================================
// 1. DYNAMIC GALLERY & ADD-ON CONFIGURATOR LOGIC
// ==========================================================================

function toggleAddon(addonId) {
    const addon = state.availableAddons.find(a => a.id === addonId);
    if (!addon) return;

    const existingIdx = state.product.selectedAddons.findIndex(a => a.id === addonId);

    if (existingIdx > -1) {
        // Uncheck / hapus addon
        state.product.selectedAddons.splice(existingIdx, 1);
    } else {
        // Logika eksklusif: Jika pilih Paket Lengkap, uncheck Mangga, Stroberi, dan Keju terpisah (karena sudah termasuk lengkap)
        if (addonId === 'combo_lengkap') {
            state.product.selectedAddons = state.product.selectedAddons.filter(
                a => a.id !== 'extra_mangga' && a.id !== 'extra_stroberi' && a.id !== 'extra_keju'
            );
        } else if (addonId === 'extra_mangga' || addonId === 'extra_stroberi' || addonId === 'extra_keju') {
            state.product.selectedAddons = state.product.selectedAddons.filter(
                a => a.id !== 'combo_lengkap'
            );
        }
        state.product.selectedAddons.push(addon);
    }

    // Tentukan gambar galeri otomatis berdasarkan kombinasi add-on
    syncGalleryWithAddons();
    updateConfiguratorUI();
}

function syncGalleryWithAddons() {
    const hasMangga = state.product.selectedAddons.some(a => a.id === 'extra_mangga');
    const hasStroberi = state.product.selectedAddons.some(a => a.id === 'extra_stroberi');
    const hasLengkap = state.product.selectedAddons.some(a => a.id === 'combo_lengkap');

    let targetKey = 'original';

    if (hasLengkap || (hasMangga && hasStroberi)) {
        targetKey = 'lengkap';
    } else if (hasMangga) {
        targetKey = 'mangga';
    } else if (hasStroberi) {
        targetKey = 'stroberi';
    } else {
        targetKey = 'original';
    }

    switchGalleryView(targetKey);
}

function selectGalleryThumb(thumbKey) {
    // Sinkronisasi add-on ketika user mengklik thumbnail di galeri
    if (thumbKey === 'original') {
        // Hapus topping buah & combo
        state.product.selectedAddons = state.product.selectedAddons.filter(
            a => a.id === 'extra_keju'
        );
    } else if (thumbKey === 'mangga') {
        const addonMangga = state.availableAddons.find(a => a.id === 'extra_mangga');
        state.product.selectedAddons = state.product.selectedAddons.filter(
            a => a.id !== 'combo_lengkap' && a.id !== 'extra_stroberi'
        );
        if (!state.product.selectedAddons.some(a => a.id === 'extra_mangga')) {
            state.product.selectedAddons.push(addonMangga);
        }
    } else if (thumbKey === 'stroberi') {
        const addonStroberi = state.availableAddons.find(a => a.id === 'extra_stroberi');
        state.product.selectedAddons = state.product.selectedAddons.filter(
            a => a.id !== 'combo_lengkap' && a.id !== 'extra_mangga'
        );
        if (!state.product.selectedAddons.some(a => a.id === 'extra_stroberi')) {
            state.product.selectedAddons.push(addonStroberi);
        }
    } else if (thumbKey === 'lengkap') {
        const addonLengkap = state.availableAddons.find(a => a.id === 'combo_lengkap');
        state.product.selectedAddons = state.product.selectedAddons.filter(
            a => a.id !== 'extra_mangga' && a.id !== 'extra_stroberi' && a.id !== 'extra_keju'
        );
        if (!state.product.selectedAddons.some(a => a.id === 'combo_lengkap')) {
            state.product.selectedAddons.push(addonLengkap);
        }
    }

    switchGalleryView(thumbKey);
    updateConfiguratorUI();
}

function switchGalleryView(galleryKey) {
    state.currentGalleryKey = galleryKey;
    const galleryData = state.galleryImages[galleryKey];
    if (!galleryData) return;

    const mainImg = document.getElementById('mainGalleryImg');
    const activeLabel = document.getElementById('galleryActiveLabel');

    if (mainImg) {
        // Efek transisi halus saat berganti foto
        mainImg.classList.add('switching');
        setTimeout(() => {
            mainImg.src = galleryData.src;
            mainImg.alt = galleryData.label;
            mainImg.classList.remove('switching');
        }, 150);
    }

    if (activeLabel) {
        activeLabel.innerHTML = `<i class="fa-solid fa-sparkles"></i> ${galleryData.label}`;
    }

    // Update active state pada thumbnail
    document.querySelectorAll('.gallery-thumb').forEach(thumb => {
        const key = thumb.getAttribute('data-thumb-key');
        thumb.classList.toggle('active', key === galleryKey);
    });
}

function changeProductQty(delta) {
    state.product.qty = Math.max(1, state.product.qty + delta);
    const qtyEl = document.getElementById('productQtyDisplay');
    if (qtyEl) {
        qtyEl.innerText = state.product.qty;
    }
    updateConfiguratorUI();
}

function updateConfiguratorUI() {
    // Hitung harga satuan dan total (Ketan Susu Original Rp 7.000)
    const unitPrice = state.product.basePrice;
    const totalPrice = unitPrice * state.product.qty;

    // Update Banner Harga
    const priceAmountEl = document.getElementById('dynamicPriceAmount');
    const priceBreakdownEl = document.getElementById('priceBreakdownTag');
    const btnCtaText = document.getElementById('btnCtaText');

    if (priceAmountEl) {
        priceAmountEl.innerText = unitPrice.toLocaleString('id-ID');
    }

    if (priceBreakdownEl) {
        priceBreakdownEl.innerText = 'Porsi Pas & Pulen';
        priceBreakdownEl.style.display = 'inline-block';
    }

    if (btnCtaText) {
        btnCtaText.innerText = `Tambah ke Keranjang — Rp ${totalPrice.toLocaleString('id-ID')}`;
    }
}

// ==========================================================================
// 2. ADD TO CART & CART DRAWER MANAGEMENT
// ==========================================================================

function addConfiguredProductToCart() {
    const p = state.product;
    const unitPrice = p.basePrice;
    const variantName = p.name;
    const cartItemId = 'ketan_original';

    const existingIndex = state.cart.findIndex(i => i.cartItemId === cartItemId);

    if (existingIndex > -1) {
        state.cart[existingIndex].qty += p.qty;
    } else {
        state.cart.push({
            cartItemId: cartItemId,
            productId: p.id,
            name: variantName,
            basePrice: p.basePrice,
            addons: [],
            unitPrice: unitPrice,
            qty: p.qty,
            category: 'Ketan Susu Pilihan'
        });
    }

    const addedCount = p.qty;
    // Reset jumlah kembali ke 1
    p.qty = 1;
    const qtyEl = document.getElementById('productQtyDisplay');
    if (qtyEl) qtyEl.innerText = 1;
    updateConfiguratorUI();

    updateCartUI();
    showToast(`🥣 ${variantName} (${addedCount} porsi) berhasil dimasukkan ke keranjang!`);
}

function addStandaloneAddon(addonId) {
    const hasMainMenu = state.cart.some(item => item.category !== 'Extra Topping');
    if (!hasMainMenu) {
        showToast('⚠️ Masukkan menu utama Ketan Susu ke keranjang terlebih dahulu sebelum menambah topping ekstra!');
        return;
    }

    const addon = state.availableAddons.find(a => a.id === addonId);
    if (!addon) return;

    const cartItemId = `addon__${addon.id}`;
    const existingIndex = state.cart.findIndex(i => i.cartItemId === cartItemId);

    if (existingIndex > -1) {
        state.cart[existingIndex].qty += 1;
    } else {
        state.cart.push({
            cartItemId: cartItemId,
            productId: addon.id,
            name: `Topping Tambahan: ${addon.name}`,
            basePrice: addon.price,
            addons: [],
            unitPrice: addon.price,
            qty: 1,
            category: 'Extra Topping'
        });
    }

    updateCartUI();
    showToast(`✨ ${addon.name} ditambahkan ke keranjang!`);
}

function changeCartItemQty(index, delta) {
    if (!state.cart[index]) return;

    state.cart[index].qty += delta;
    if (state.cart[index].qty <= 0) {
        removeFromCart(index);
    } else {
        updateCartUI();
    }
}

function removeFromCart(index) {
    const removed = state.cart.splice(index, 1);
    const hasMainMenu = state.cart.some(item => item.category !== 'Extra Topping');
    if (!hasMainMenu && state.cart.length > 0) {
        state.cart = [];
        showToast('ℹ️ Topping ekstra otomatis dibersihkan karena menu utama dihapus.');
    } else if (removed.length > 0) {
        showToast(`Pesanan ${removed[0].name} dihapus.`);
    }
    updateCartUI();
}

function updateCartUI() {
    const cartCountBadge = document.getElementById('cartCountBadge');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartTotal = document.getElementById('cartTotal');

    const totalItemCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartCountBadge) cartCountBadge.innerText = totalItemCount;

    let subtotal = 0;
    if (cartItemsList) cartItemsList.innerHTML = '';

    if (state.cart.length === 0) {
        if (cartItemsList) {
            cartItemsList.innerHTML = `
                <div class="empty-cart-state">
                    <i class="fa-solid fa-bowl-rice"></i>
                    <p>Keranjang kamu masih kosong</p>
                    <small>Yuk buat kombinasi Ketan Susu Kethai & Co favoritmu!</small>
                </div>
            `;
        }
    } else {
        state.cart.forEach((item, index) => {
            const itemTotal = item.unitPrice * item.qty;
            subtotal += itemTotal;

            if (cartItemsList) {
                const row = document.createElement('div');
                row.className = 'cart-item-row';

                let addonsHTML = '';
                if (item.addons && item.addons.length > 0) {
                    addonsHTML = `
                        <div class="cart-item-addons">
                            ${item.addons.map(a => `<span class="cart-addon-tag"><i class="fa-solid fa-plus"></i> ${a.name} (Rp ${a.price.toLocaleString('id-ID')})</span>`).join('')}
                        </div>
                    `;
                }

                row.innerHTML = `
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.name}</div>
                        ${addonsHTML}
                        <div class="cart-item-sub">
                            <span>Rp ${item.unitPrice.toLocaleString('id-ID')} / porsi</span>
                        </div>
                    </div>
                    <div class="cart-item-controls">
                        <div class="cart-qty-pill">
                            <button type="button" onclick="changeCartItemQty(${index}, -1)" title="Kurangi">−</button>
                            <span>${item.qty}</span>
                            <button type="button" onclick="changeCartItemQty(${index}, 1)" title="Tambah">+</button>
                        </div>
                        <div class="cart-item-total">Rp ${itemTotal.toLocaleString('id-ID')}</div>
                        <button class="btn-icon btn-delete" onclick="removeFromCart(${index})" title="Hapus menu">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;
                cartItemsList.appendChild(row);
            }
        });
    }

    if (cartSubtotal) cartSubtotal.innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    if (cartTotal) cartTotal.innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;

    // Update status Booster Topping Ekstra (Wajib ada menu utama)
    const hasMainMenu = state.cart.some(item => item.category !== 'Extra Topping');
    const boosterSection = document.getElementById('cartBoosterSection');
    const boosterTag = document.getElementById('cartBoosterTag');
    const boosterBtns = document.querySelectorAll('.cart-booster-btn');

    if (boosterSection) {
        if (!hasMainMenu) {
            boosterSection.classList.add('disabled-state');
            if (boosterTag) {
                boosterTag.classList.add('locked');
                boosterTag.innerHTML = '<i class="fa-solid fa-lock"></i> Masukkan menu utama dulu';
            }
            boosterBtns.forEach(btn => {
                btn.classList.add('locked');
                btn.title = 'Pilih dan masukkan menu utama Ketan Susu ke keranjang terlebih dahulu';
            });
        } else {
            boosterSection.classList.remove('disabled-state');
            if (boosterTag) {
                boosterTag.classList.remove('locked');
                boosterTag.innerHTML = 'Satuan 2rb • Lengkap 5rb';
            }
            boosterBtns.forEach(btn => {
                btn.classList.remove('locked');
                btn.removeAttribute('title');
            });
        }
    }

    updateQrisAmountDisplay();
    updateCampusMinOrderValidation();
    updateWAPreview();
}

// ==========================================================================
// 3. PAYMENT METHOD & VERIFIKASI QRIS LOGIC (ANTI-PEMBELI FIKTIF)
// ==========================================================================

function updateQrisAmountDisplay() {
    const totalAmount = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    const formatted = totalAmount > 0 ? `Rp ${totalAmount.toLocaleString('id-ID')}` : 'Rp 0';

    const displayEl = document.getElementById('qrisDynamicAmountDisplay');
    if (displayEl) displayEl.innerText = formatted;

    const modalAmountEl = document.getElementById('qrisModalAmount');
    if (modalAmountEl) modalAmountEl.innerText = formatted;
}

function copyQrisAmount() {
    const totalAmount = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    if (totalAmount <= 0) {
        showToast('⚠️ Keranjang belanja masih kosong.');
        return;
    }
    const nominalStr = totalAmount.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(nominalStr).then(() => {
            showToast(`📋 Nominal Rp ${totalAmount.toLocaleString('id-ID')} berhasil disalin!`);
        }).catch(() => {
            showToast(`Nominal: Rp ${totalAmount.toLocaleString('id-ID')}`);
        });
    } else {
        showToast(`Nominal: Rp ${totalAmount.toLocaleString('id-ID')}`);
    }
}

function compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.82) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = () => resolve(event.target.result);
        };
        reader.onerror = () => resolve(null);
    });
}

async function processProofFile(file) {
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
        showToast('⚠️ File harus berupa gambar screenshot (JPG, PNG, WebP).');
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        showToast('⚠️ Ukuran gambar maksimal 8 MB.');
        return;
    }

    state.qrisProofFilename = file.name || 'bukti_transfer.jpg';

    showToast('⏳ Memproses screenshot bukti bayar...');
    try {
        const optimizedDataUrl = await compressImage(file, 1000, 1000, 0.82);
        if (!optimizedDataUrl) {
            showToast('⚠️ Gagal membaca gambar screenshot.');
            return;
        }

        state.qrisProofDataUrl = optimizedDataUrl;

        const previewImg = document.getElementById('proofPreviewImg');
        const filenameEl = document.getElementById('proofFileName');
        const dropzoneIdle = document.getElementById('dropzoneIdle');
        const dropzonePreview = document.getElementById('dropzonePreview');

        if (previewImg) previewImg.src = state.qrisProofDataUrl;
        if (filenameEl) filenameEl.innerText = state.qrisProofFilename;
        if (dropzoneIdle) dropzoneIdle.style.display = 'none';
        if (dropzonePreview) dropzonePreview.style.display = 'flex';

        showToast('✅ Bukti screenshot pembayaran QRIS berhasil dilampirkan!');
    } catch (err) {
        console.error('Error optimizing image:', err);
        showToast('⚠️ Gagal memproses gambar bukti bayar.');
    }
}

function handleProofFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (file) processProofFile(file);
}

function setupProofDropzone() {
    const dropzone = document.getElementById('proofDropzone');
    if (!dropzone) return;

    // Pasang event listener drag & drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        }, false);
    });

    ['dragleave', 'dragend'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');

        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
            processProofFile(dt.files[0]);
        }
    }, false);
}

function removeProofFile(event) {
    if (event) event.stopPropagation();
    state.qrisProofDataUrl = null;
    state.qrisProofFilename = '';

    const input = document.getElementById('qrisProofFile');
    if (input) input.value = '';

    const dropzoneIdle = document.getElementById('dropzoneIdle');
    const dropzonePreview = document.getElementById('dropzonePreview');

    if (dropzoneIdle) dropzoneIdle.style.display = 'flex';
    if (dropzonePreview) dropzonePreview.style.display = 'none';
}

function startQrisTimer() {
    // Timer dinonaktifkan sesuai preferensi tampilan
}

function stopQrisTimer() {
    if (state.qrisTimerInterval) {
        clearInterval(state.qrisTimerInterval);
        state.qrisTimerInterval = null;
    }
}

function updateTimerText() {
    // No-op
}

function selectPaymentMethod(method) {
    state.paymentMethod = method;

    const optQris = document.getElementById('opt-qris');
    const optCash = document.getElementById('opt-cash');
    const radioQris = document.getElementById('radio-qris');
    const radioCash = document.getElementById('radio-cash');
    const qrisSection = document.getElementById('qrisPaymentSection');
    const cashHelperBox = document.getElementById('cashHelperBox');
    const btnSubmit = document.getElementById('btnSubmitWA');
    const checkoutStatusBadge = document.getElementById('checkoutStatusBadge');

    const activeAdmin = state.admins.find(a => a.id === state.selectedAdminId) || state.admins[0];

    if (method === 'qris') {
        optQris?.classList.add('active');
        optCash?.classList.remove('active');
        if (radioQris) radioQris.checked = true;
        if (qrisSection) qrisSection.style.display = 'block';
        if (cashHelperBox) cashHelperBox.style.display = 'none';
        if (btnSubmit) {
            btnSubmit.className = 'btn btn-primary btn-block';
            btnSubmit.innerHTML = `<i class="fa-solid fa-shield-check"></i> Verifikasi Pembayaran & Selesaikan Pesanan`;
        }
        if (checkoutStatusBadge) {
            checkoutStatusBadge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Verifikasi keamanan aktif. Pesanan tervalidasi sebelum masuk ke Google Spreadsheet.`;
        }
        startQrisTimer();
        updateQrisAmountDisplay();
    } else {
        optCash?.classList.add('active');
        optQris?.classList.remove('active');
        if (radioCash) radioCash.checked = true;
        if (qrisSection) qrisSection.style.display = 'none';
        if (cashHelperBox) cashHelperBox.style.display = 'flex';
        if (btnSubmit) {
            btnSubmit.className = 'btn btn-whatsapp btn-block';
            btnSubmit.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Konfirmasi Pesanan COD ke ${activeAdmin.name}`;
        }
        if (checkoutStatusBadge) {
            checkoutStatusBadge.innerHTML = `<i class="fa-solid fa-hand-holding-dollar"></i> Pesanan COD tercatat & diteruskan langsung ke WhatsApp admin.`;
        }
        stopQrisTimer();
    }

    updateWAPreview();
}

function openQRISModal() {
    const qrisModal = document.getElementById('qrisModal');
    updateQrisAmountDisplay();

    if (qrisModal) {
        qrisModal.classList.add('active');
    }
}

function closeQRISModal() {
    document.getElementById('qrisModal')?.classList.remove('active');
}

// ==========================================================================
// 4. WHATSAPP DYNAMIC CHECKOUT ENGINE
// ==========================================================================

function selectAdmin(adminId) {
    const admin = state.admins.find(a => a.id === adminId);
    if (!admin) return;

    state.selectedAdminId = adminId;
    state.targetWA = admin.waNumber;

    document.querySelectorAll('.admin-option-card').forEach(card => {
        card.classList.toggle('active', card.id === `opt-${adminId}`);
    });

    const radio = document.getElementById(`radio-${adminId}`);
    if (radio) radio.checked = true;

    const btnSubmit = document.getElementById('btnSubmitWA');
    if (btnSubmit) {
        if (state.paymentMethod === 'cash') {
            btnSubmit.className = 'btn btn-whatsapp btn-block';
            btnSubmit.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Konfirmasi Pesanan COD ke ${admin.name}`;
        } else {
            btnSubmit.className = 'btn btn-primary btn-block';
            btnSubmit.innerHTML = `<i class="fa-solid fa-shield-check"></i> Verifikasi Pembayaran & Selesaikan Pesanan`;
        }
    }

    updateWAPreview();
}

function getCartMainItemCount() {
    return state.cart
        .filter(item => item.category !== 'Extra Topping')
        .reduce((sum, item) => sum + (item.qty || 1), 0);
}

function updateCampusMinOrderValidation() {
    const campusSelect = document.getElementById('custCampus');
    const noticeEl = document.getElementById('campusMinOrderNotice');
    if (!campusSelect || !noticeEl) return;

    const campus = campusSelect.value;
    const isMinOrderCampus = (campus === 'Kampus B' || campus === 'Kampus C');

    if (!isMinOrderCampus) {
        noticeEl.style.display = 'none';
        return;
    }

    noticeEl.style.display = 'flex';
    const totalPcs = getCartMainItemCount();
    const shortage = Math.max(0, 7 - totalPcs);
    const percentage = Math.min(100, Math.round((totalPcs / 7) * 100));

    const titleEl = document.getElementById('minOrderTitle');
    const descEl = document.getElementById('minOrderDesc');
    const campusLabel = document.getElementById('minOrderCampusLabel');
    const fillEl = document.getElementById('minOrderProgressFill');
    const currentPcsEl = document.getElementById('currentPcsCount');
    const shortageEl = document.getElementById('minOrderShortage');
    const iconEl = document.getElementById('minOrderIcon');

    if (campusLabel) campusLabel.innerText = campus;
    if (currentPcsEl) currentPcsEl.innerText = totalPcs;
    if (fillEl) fillEl.style.width = `${percentage}%`;

    if (totalPcs < 7) {
        noticeEl.className = 'campus-min-order-alert warning-mode';
        if (iconEl) iconEl.className = 'fa-solid fa-circle-exclamation alert-icon';
        if (titleEl) titleEl.innerHTML = `⚠️ Minimal Order 7 Pcs (${campus})`;
        if (descEl) descEl.innerText = `Untuk pengantaran ke ${campus}, pemesanan harus mencapai minimal 7 porsi ketan susu.`;
        if (shortageEl) {
            shortageEl.className = 'shortage-badge';
            shortageEl.innerText = `Kurang ${shortage} porsi lagi`;
        }
    } else {
        noticeEl.className = 'campus-min-order-alert success-mode';
        if (iconEl) iconEl.className = 'fa-solid fa-circle-check alert-icon';
        if (titleEl) titleEl.innerHTML = `✅ Syarat Minimal Order Terpenuhi! (${campus})`;
        if (descEl) descEl.innerText = `Mantap! Total pesananmu (${totalPcs} porsi) memenuhi batas minimum pengantaran.`;
        if (shortageEl) {
            shortageEl.className = 'shortage-badge success';
            shortageEl.innerText = `Siap Diantar!`;
        }
    }
}

function handleLocationChange() {
    const campusSelect = document.getElementById('custCampus');
    const majorGroup = document.getElementById('custMajorGroup');
    const majorSelect = document.getElementById('custMajor');
    const otherGroup = document.getElementById('custOtherAddressGroup');
    const otherTextarea = document.getElementById('custAddressOther');

    if (!campusSelect) return;
    const selectedCampus = campusSelect.value;

    if (selectedCampus === 'Kampus Stasiun Bumi (SB)') {
        // KHUSUS Kampus SB: Tampilkan dan aktifkan pilihan jurusan
        if (majorGroup) {
            majorGroup.classList.remove('field-disabled');
            majorGroup.style.display = 'flex';
        }
        if (majorSelect) {
            majorSelect.required = true;
            majorSelect.disabled = false;
        }

        // Sembunyikan input alamat luar kampus
        if (otherGroup) otherGroup.style.display = 'none';
        if (otherTextarea) {
            otherTextarea.required = false;
            otherTextarea.value = '';
        }
    } else if (selectedCampus === 'Lainnya') {
        // Luar kampus: Tampilkan input alamat lengkap, sembunyikan/nonaktifkan jurusan
        if (otherGroup) otherGroup.style.display = 'flex';
        if (otherTextarea) otherTextarea.required = true;

        if (majorGroup) {
            majorGroup.classList.add('field-disabled');
            majorGroup.style.display = 'none';
        }
        if (majorSelect) {
            majorSelect.required = false;
            majorSelect.value = '';
            majorSelect.disabled = true;
        }
    } else {
        // Kampus B atau Kampus C: Tidak ada pilihan jurusan dan tidak perlu alamat luar kampus
        if (majorGroup) {
            majorGroup.classList.add('field-disabled');
            majorGroup.style.display = 'none';
        }
        if (majorSelect) {
            majorSelect.required = false;
            majorSelect.value = '';
            majorSelect.disabled = true;
        }

        if (otherGroup) otherGroup.style.display = 'none';
        if (otherTextarea) {
            otherTextarea.required = false;
            otherTextarea.value = '';
        }
    }

    updateCampusMinOrderValidation();
    updateWAPreview();
}

function generateWAMessage() {
    const custName = document.getElementById('custName')?.value.trim() || '[Nama Kamu]';
    const rawPhone = document.getElementById('custPhone')?.value || '';
    const custPhone = rawPhone.replace(/\D/g, '') || '[Nomor WA Kamu]';
    const campus = document.getElementById('custCampus')?.value || '';
    const major = document.getElementById('custMajor')?.value || '';
    const otherAddr = document.getElementById('custAddressOther')?.value.trim() || '';

    let locationSummary = '[Pilih Lokasi Pengiriman]';
    if (campus === 'Lainnya') {
        locationSummary = otherAddr ? `Luar Kampus: ${otherAddr}` : 'Luar Kampus';
    } else if (campus === 'Kampus Stasiun Bumi (SB)') {
        locationSummary = major ? `${campus} (Jurusan: ${major})` : campus;
    } else if (campus) {
        // Kampus B atau Kampus C (tanpa pilihan jurusan)
        locationSummary = campus;
    }

    const custNotes = document.getElementById('custNotes')?.value.trim() || '-';
    const activeAdmin = state.admins.find(a => a.id === state.selectedAdminId) || state.admins[0];

    if (state.cart.length === 0) {
        return 'Belum ada pesanan Ketan Susu di keranjang.';
    }

    let itemsText = '';
    let grandTotal = 0;

    state.cart.forEach((item, index) => {
        const itemTotal = item.unitPrice * item.qty;
        grandTotal += itemTotal;

        let addonDetail = '';
        if (item.addons && item.addons.length > 0) {
            addonDetail = `\n   + Topping: ` + item.addons.map(a => `${a.name} (+Rp ${a.price.toLocaleString('id-ID')})`).join(', ');
        }

        itemsText += `${index + 1}. *${item.name}*${addonDetail}\n   - ${item.qty} porsi x Rp ${item.unitPrice.toLocaleString('id-ID')} = *Rp ${itemTotal.toLocaleString('id-ID')}*\n`;
    });

    const paymentText = state.paymentMethod === 'qris'
        ? `*METODE PEMBAYARAN:* QRIS (E-Wallet & Bank)\n_(Bukti transfer/screenshot pembayaran sudah saya unggah & siap saya kirimkan)_`
        : `*METODE PEMBAYARAN:* Bayar Tunai / Langsung (COD)\n_(Siapkan uang pas saat pesanan diantar ya kak)_`;

    const messageTemplate =
        `Halo Admin ${activeAdmin.name} (Kethai & Co)!
Saya mau order Ketan Susu nikmat nih:

*RINCIAN PESANAN KETHAI & CO:*
${itemsText}
*TOTAL PEMBAYARAN:* Rp ${grandTotal.toLocaleString('id-ID')}
_(Bebas Biaya Platform / 0% Mark-Up)_

${paymentText}

*DATA PEMESAN:*
- Nama Pemesan: *${custName}*
- Nomor WhatsApp: *${custPhone}*
- Lokasi Pengiriman: *${locationSummary}*
- Catatan Khusus: _${custNotes}_
- Admin Penerima: *${activeAdmin.fullName}*

Mohon dikonfirmasi & segera diproses ya min. Terima kasih!`;

    return messageTemplate;
}

function updateWAPreview() {
    const previewContainer = document.getElementById('waMessagePreview');
    if (previewContainer) {
        previewContainer.innerText = generateWAMessage();
    }
}

// ==========================================================================
// 5. SPREADSHEET & LIVE STATUS ENGINE
// ==========================================================================

const ORDER_STATUS_CONFIG = {
    masuk: {
        label: 'Pesanan Berhasil Masuk',
        step: 1,
        icon: 'fa-solid fa-inbox',
        badgeClass: 'badge-status-masuk'
    },
    dibuat: {
        label: 'Pesanan Sedang Dibuat',
        step: 2,
        icon: 'fa-solid fa-fire-burner',
        badgeClass: 'badge-status-dibuat'
    },
    selesai: {
        label: 'Pesanan Sudah Selesai Dibuat',
        step: 3,
        icon: 'fa-solid fa-utensils',
        badgeClass: 'badge-status-selesai'
    },
    kirim: {
        label: 'Pesanan Akan Dikirim',
        step: 4,
        icon: 'fa-solid fa-person-biking',
        badgeClass: 'badge-status-kirim'
    }
};

function parseOrderStatus(statusStr) {
    const s = (statusStr || '').toLowerCase();
    if (s.includes('kirim') || s.includes('antar') || s.includes('jalan')) {
        return ORDER_STATUS_CONFIG.kirim;
    }
    if (s.includes('selesai') || s.includes('siap')) {
        return ORDER_STATUS_CONFIG.selesai;
    }
    if (s.includes('buat') || s.includes('proses') || s.includes('masak')) {
        return ORDER_STATUS_CONFIG.dibuat;
    }
    return ORDER_STATUS_CONFIG.masuk;
}

function updateReceiptTracker(statusStr) {
    const statusCfg = parseOrderStatus(statusStr || 'Pesanan Berhasil Masuk');
    const pill = document.getElementById('receiptLiveStatusPill');
    if (pill) {
        pill.className = `badge-order-status ${statusCfg.badgeClass}`;
        pill.innerHTML = `<i class="${statusCfg.icon}"></i> ${statusCfg.label}`;
    }

    const step = statusCfg.step; // 1, 2, 3, or 4
    for (let i = 1; i <= 4; i++) {
        const p = document.getElementById(`stepPoint${i}`);
        if (p) {
            p.classList.remove('active', 'completed');
            if (i < step) p.classList.add('completed');
            else if (i === step) p.classList.add('active');
        }
    }
    for (let j = 1; j <= 3; j++) {
        const l = document.getElementById(`stepLine${j}`);
        if (l) {
            if (j < step) l.classList.add('active');
            else l.classList.remove('active');
        }
    }
}

function getLocalOrders() {
    try {
        const data = localStorage.getItem('kethai_co_orders') || localStorage.getItem('ketai_co_orders') || localStorage.getItem('bite_chill_orders');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveOrderLocally(order) {
    try {
        const orders = getLocalOrders();
        // Simpan berurutan dari atas ke bawah
        orders.push(order);
        localStorage.setItem('kethai_co_orders', JSON.stringify(orders));
    } catch (e) {
        console.warn('Gagal menyimpan pesanan ke localStorage', e);
    }
}

function updateOrderStatusLocally(orderId, newStatus) {
    const orders = getLocalOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.orderStatus = newStatus;
        localStorage.setItem('kethai_co_orders', JSON.stringify(orders));
        renderOrdersTable();
        showToast(`🔄 Status ${orderId}: "${newStatus}"`);

        // Jika pesanan yang sama sedang aktif di struk layar sukses, update juga
        if (state.lastVerifiedOrder && state.lastVerifiedOrder.id === orderId) {
            state.lastVerifiedOrder.orderStatus = newStatus;
            updateReceiptTracker(newStatus);
        }
    }
}

async function clearOrdersLog() {
    if (!confirm('Apakah kamu yakin ingin menghapus data riwayat uji coba pesanan Kethai & Co? Data di Google Spreadsheet juga akan otomatis dibersihkan.')) {
        return;
    }

    // 1. Bersihkan memori lokal browser
    localStorage.removeItem('kethai_co_orders');
    localStorage.removeItem('ketai_co_orders');
    localStorage.removeItem('bite_chill_orders');
    state.lastVerifiedOrder = null;
    renderOrdersTable();

    // 2. Bersihkan Google Spreadsheet jika endpoint aktif
    if (state.sheetsEndpointURL) {
        showToast('⏳ Membersihkan riwayat pesanan di Google Spreadsheet...');
        try {
            await fetch(`${state.sheetsEndpointURL}?action=clearOrders&t=${Date.now()}`);
            showToast('🗑️ Riwayat uji coba berhasil dihapus dari web & Google Spreadsheet!');
        } catch (err) {
            try {
                await fetch(state.sheetsEndpointURL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clearOrders' })
                });
                showToast('🗑️ Riwayat uji coba berhasil dihapus dari web & Google Spreadsheet!');
            } catch (postErr) {
                console.warn('Gagal menghapus di spreadsheet:', postErr);
                showToast('🗑️ Riwayat pesanan lokal berhasil dibersihkan.');
            }
        }
    } else {
        showToast('🗑️ Riwayat pesanan berhasil dibersihkan.');
    }
}

async function syncOrderToSpreadsheet(orderData) {
    if (!state.sheetsEndpointURL) {
        console.log('Catatan: Google Sheets Webhook URL belum diisi. Data tersimpan lokal di browser.', orderData);
        return;
    }

    try {
        await fetch(state.sheetsEndpointURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        console.log('Berhasil mengirim data pesanan ke Google Spreadsheet!');
    } catch (error) {
        console.warn('Gagal sync ke Google Sheets (tetap aman tersimpan lokal):', error);
    }
}

function fetchOrdersViaJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'kethai_cb_' + Math.round(1000000 * Math.random());
        let script = null;
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Koneksi Google Apps Script timeout (15 detik). Pastikan New Version sudah di-deploy dengan akses Siapa Saja (Anyone).'));
        }, 15000);

        function cleanup() {
            clearTimeout(timeout);
            try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
            if (script && script.parentNode) script.parentNode.removeChild(script);
        }

        window[callbackName] = function(data) {
            cleanup();
            resolve(data);
        };

        script = document.createElement('script');
        const sep = url.indexOf('?') >= 0 ? '&' : '?';
        script.src = `${url}${sep}action=getOrders&callback=${callbackName}&t=${Date.now()}`;
        script.onerror = function() {
            cleanup();
            reject(new Error('Gagal memuat respons script dari Google Apps Script.'));
        };
        document.head.appendChild(script);
    });
}

async function fetchLiveOrdersFromSpreadsheet(isSilent = false) {
    const refreshIcon = document.getElementById('refreshIcon');

    if (!state.sheetsEndpointURL) {
        if (!isSilent) showToast('ℹ️ Data aktif dari memori lokal (URL Spreadsheet belum dikonfigurasi).');
        renderOrdersTable();
        return;
    }

    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    if (!isSilent) showToast('🔄 Menghubungkan & mengambil status dari Google Spreadsheet...');

    let resData = null;
    let fetchError = null;

    try {
        // Metode 1: Coba Fetch langsung
        try {
            const response = await fetch(`${state.sheetsEndpointURL}?action=getOrders&t=${Date.now()}`);
            if (response.ok) {
                resData = await response.json();
            }
        } catch (fErr) {
            console.warn('Fetch langsung terhalang CORS/Network, beralih ke JSONP anti-CORS:', fErr);
            fetchError = fErr;
        }

        // Metode 2: Coba JSONP (Bebas hambatan CORS 100%)
        if (!resData || resData.status !== 'success') {
            resData = await fetchOrdersViaJSONP(state.sheetsEndpointURL);
        }

        if (resData && resData.status === 'success' && Array.isArray(resData.orders)) {
            const liveOrders = resData.orders;
            const localOrders = getLocalOrders();
            const localMap = new Map();
            localOrders.forEach(lo => {
                if (lo && lo.id) localMap.set(lo.id, lo);
            });

            // Sinkronisasi Sempurna: Google Spreadsheet adalah acuan utama (Source of Truth).
            // Jika ada baris yang dihapus di spreadsheet, otomatis tidak muncul lagi di online!
            const syncedOrders = liveOrders.map(lo => {
                const localMatch = localMap.get(lo.id);
                return {
                    id: lo.id,
                    date: lo.date || (localMatch ? localMatch.date : '-'),
                    time: lo.time || (localMatch ? localMatch.time : '-'),
                    customerName: lo.customerName || (localMatch ? localMatch.customerName : '-'),
                    customerPhone: lo.customerPhone || (localMatch ? localMatch.customerPhone : '-'),
                    campus: lo.campus || (localMatch ? localMatch.campus : '-'),
                    major: lo.major || (localMatch ? localMatch.major : '-'),
                    customerAddress: lo.customerAddress || (localMatch ? localMatch.customerAddress : '-'),
                    itemsSummary: lo.itemsSummary || (localMatch ? localMatch.itemsSummary : '-'),
                    adminTarget: lo.adminTarget || (localMatch ? localMatch.adminTarget : 'Admin 1 (Malik)'),
                    paymentMethod: lo.paymentMethod || (localMatch ? localMatch.paymentMethod : 'QRIS'),
                    totalAmount: Number(lo.totalAmount || (localMatch ? localMatch.totalAmount : 0)),
                    orderStatus: (lo.orderStatus && lo.orderStatus.trim()) ? lo.orderStatus.trim() : 'Pesanan Berhasil Masuk',
                    customerNotes: lo.customerNotes || (localMatch ? localMatch.customerNotes : '-'),
                    proofImage: (localMatch && localMatch.proofImage) ? localMatch.proofImage : null
                };
            });

            localStorage.setItem('kethai_co_orders', JSON.stringify(syncedOrders));
            renderOrdersTable();

            // Update live tracker jika struk aktif sedang tampil
            if (state.lastVerifiedOrder) {
                const found = syncedOrders.find(o => o.id === state.lastVerifiedOrder.id);
                if (found && found.orderStatus) {
                    state.lastVerifiedOrder.orderStatus = found.orderStatus;
                    updateReceiptTracker(found.orderStatus);
                }
            }

            if (!isSilent) {
                showToast(`✅ Status berhasil diperbarui dari Spreadsheet (${syncedOrders.length} pesanan)!`);
            }
        } else {
            renderOrdersTable();
            if (!isSilent) showToast('ℹ️ Spreadsheet belum memiliki data baris pesanan.');
        }
    } catch (err) {
        console.error('Gagal fetch live dari Google Sheets:', err, fetchError);
        renderOrdersTable();
        if (!isSilent) {
            showToast('⚠️ Gagal terhubung ke Google Sheets. Pastikan kamu sudah klik "Deploy > Manage deployments > Edit > New version" di Apps Script.');
        }
    } finally {
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const orders = getLocalOrders();
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <i class="fa-solid fa-clipboard-list" style="font-size: 2.2rem; margin-bottom: 0.6rem; opacity: 0.4; color: var(--primary-orange);"></i>
                    <p style="font-weight: 700; color: var(--text-heading);">Belum ada data pesanan hari ini.</p>
                    <small>Lakukan pemesanan di web untuk melihat data otomatis masuk ke spreadsheet!</small>
                </td>
            </tr>
        `;
        return;
    }

    // Urutan tetap dari atas: Pesanan No 1 di paling atas, bertambah ke bawah (No 2, 3, dst.)
    const sortedOrders = [...orders].sort((a, b) => {
        const idA = parseInt((a.id || '').replace(/\D/g, '') || '0', 10);
        const idB = parseInt((b.id || '').replace(/\D/g, '') || '0', 10);
        return idA - idB;
    });

    sortedOrders.forEach((order, index) => {
        const tr = document.createElement('tr');
        const isQRIS = order.paymentMethod && order.paymentMethod.toLowerCase().includes('qris');
        const payBadgeClass = isQRIS ? 'badge-pay-qris' : 'badge-pay-cash';
        const noUrut = index + 1;
        const currentStatus = order.orderStatus || 'Pesanan Berhasil Masuk';
        const statusCfg = parseOrderStatus(currentStatus);

        let proofBtnHTML = `<span class="badge-proof-cash"><i class="fa-solid fa-money-bill-wave"></i> Tunai</span>`;
        if (isQRIS) {
            if (order.proofImage) {
                proofBtnHTML = `
                    <button type="button" class="btn-view-proof" onclick="openProofViewerModal('${order.id}')" title="Lihat Bukti Transfer">
                        <img src="${order.proofImage}" alt="Thumb" class="proof-thumbnail-mini">
                        <span>Bukti</span>
                    </button>
                `;
            } else {
                proofBtnHTML = `<span class="badge-proof-empty">-</span>`;
            }
        }

        // Catatan: Kolom ID Pesanan dihilangkan dari tabel online sesuai preferensi,
        // dan status bersifat Read-Only (Hanya admin di Google Spreadsheet yang dapat mengubah status).
        tr.innerHTML = `
            <td style="text-align: center; font-weight: 700; color: var(--text-muted);">${noUrut}</td>
            <td><strong>${order.time}</strong><br><small style="color: var(--text-muted);">${order.date}</small></td>
            <td><strong>${order.customerName}</strong><br><small style="color: var(--text-muted);">${order.customerAddress || '-'}</small></td>
            <td><small>${order.itemsSummary}</small></td>
            <td><span class="badge-admin"><i class="fa-brands fa-whatsapp"></i> ${order.adminTarget || 'Admin 1 (Malik)'}</span></td>
            <td><span class="${payBadgeClass}">${order.paymentMethod}</span></td>
            <td><strong style="color: var(--primary-orange);">Rp ${Number(order.totalAmount || 0).toLocaleString('id-ID')}</strong></td>
            <td style="text-align: center;">
                <span class="badge-order-status ${statusCfg.badgeClass}">
                    <i class="${statusCfg.icon}"></i> ${statusCfg.label}
                </span>
            </td>
            <td style="text-align: center;">${proofBtnHTML}</td>
        `;
        tbody.appendChild(tr);
    });
}

let liveOrdersPollingInterval = null;

function openOrdersModal() {
    renderOrdersTable();
    document.getElementById('ordersModal')?.classList.add('active');
    fetchLiveOrdersFromSpreadsheet(true);

    if (liveOrdersPollingInterval) clearInterval(liveOrdersPollingInterval);
    liveOrdersPollingInterval = setInterval(() => {
        fetchLiveOrdersFromSpreadsheet(true);
    }, 20000);
}

function closeOrdersModal() {
    document.getElementById('ordersModal')?.classList.remove('active');
    if (liveOrdersPollingInterval) {
        clearInterval(liveOrdersPollingInterval);
        liveOrdersPollingInterval = null;
    }
}

function openProofViewerModal(orderId) {
    const orders = getLocalOrders();
    let order = orders.find(o => o.id === orderId);
    if (!order && state.lastVerifiedOrder && state.lastVerifiedOrder.id === orderId) {
        order = state.lastVerifiedOrder;
    }
    if (!order) {
        order = state.lastVerifiedOrder || orders.find(o => o.proofImage);
    }

    if (!order || !order.proofImage) {
        showToast('⚠️ Bukti pembayaran tidak ditemukan untuk pesanan ini.');
        return;
    }

    const orderIdEl = document.getElementById('proofMetaOrderId');
    const custEl = document.getElementById('proofMetaCust');
    const timeEl = document.getElementById('proofMetaTime');
    const totalEl = document.getElementById('proofMetaTotal');
    const imgEl = document.getElementById('proofViewerImg');
    const downloadBtn = document.getElementById('proofViewerDownloadBtn');

    if (orderIdEl) orderIdEl.innerText = order.id;
    if (custEl) custEl.innerText = order.customerName;
    if (timeEl) timeEl.innerText = `${order.date}, ${order.time}`;
    if (totalEl) totalEl.innerText = `Rp ${Number(order.totalAmount || 0).toLocaleString('id-ID')}`;
    if (imgEl) imgEl.src = order.proofImage;
    if (downloadBtn) {
        downloadBtn.href = order.proofImage;
        downloadBtn.download = `Bukti_QRIS_${order.id}_${(order.customerName || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
    }

    document.getElementById('proofViewerModal')?.classList.add('active');
}

function closeProofViewerModal() {
    document.getElementById('proofViewerModal')?.classList.remove('active');
}

function exportOrdersToCSV() {
    const orders = getLocalOrders();
    if (orders.length === 0) {
        showToast('⚠️ Belum ada pesanan untuk diekspor!');
        return;
    }

    const sortedOrders = [...orders].sort((a, b) => {
        const idA = parseInt((a.id || '').replace(/\D/g, '') || '0', 10);
        const idB = parseInt((b.id || '').replace(/\D/g, '') || '0', 10);
        return idA - idB;
    });

    const headers = ['No', 'ID Pesanan', 'Tanggal', 'Jam', 'Nama Pemesan', 'Nomor WhatsApp', 'Lokasi / Kampus', 'Jurusan', 'Alamat Lengkap', 'Rincian Menu & Topping', 'Admin Bertugas', 'Metode Pembayaran', 'Total Harga (Rp)', 'Status Info Pemesanan', 'Catatan'];

    const rows = sortedOrders.map((o, idx) => [
        idx + 1,
        `"${o.id}"`,
        `"${o.date}"`,
        `"${o.time}"`,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        `"${(o.customerPhone || '-').replace(/"/g, '""')}"`,
        `"${(o.campus || '-').replace(/"/g, '""')}"`,
        `"${(o.major || '-').replace(/"/g, '""')}"`,
        `"${(o.customerAddress || '').replace(/"/g, '""')}"`,
        `"${(o.itemsSummary || '').replace(/"/g, '""')}"`,
        `"${(o.adminTarget || 'Admin 1 (Malik)').replace(/"/g, '""')}"`,
        `"${o.paymentMethod || ''}"`,
        o.totalAmount || 0,
        `"${(o.orderStatus || 'Pesanan Berhasil Masuk').replace(/"/g, '""')}"`,
        `"${(o.customerNotes || '-').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_pesanan_kethai_co_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📥 Rekap pesanan CSV Kethai & Co berhasil didownload!');
}

// ==========================================================================
// 6. FORM SUBMISSION (DUAL ACTION: SPREADSHEET + WHATSAPP)
// ==========================================================================

function handleFormSubmit(e) {
    e.preventDefault();

    if (state.cart.length === 0) {
        showToast('⚠️ Keranjang masih kosong! Silakan pilih menu terlebih dahulu.');
        return;
    }

    const hasMainMenu = state.cart.some(item => item.category !== 'Extra Topping');
    if (!hasMainMenu) {
        showToast('⚠️ Silakan pilih dan masukkan menu utama Ketan Susu ke keranjang terlebih dahulu!');
        return;
    }

    const custName = document.getElementById('custName')?.value.trim() || 'Pelanggan';
    const rawPhone = document.getElementById('custPhone')?.value || '';
    const custPhone = rawPhone.replace(/\D/g, '');
    const custCampus = document.getElementById('custCampus')?.value || '';
    const custMajor = document.getElementById('custMajor')?.value || '';
    const custAddressOther = document.getElementById('custAddressOther')?.value.trim() || '';
    const custNotes = document.getElementById('custNotes')?.value.trim() || '-';

    // Validasi form data
    if (!custPhone || custPhone.length < 9) {
        showToast('⚠️ Silakan isi Nomor WhatsApp yang valid (hanya angka, minimal 9-10 digit)!');
        document.getElementById('custPhone')?.focus();
        return;
    }

    if (!custCampus) {
        showToast('⚠️ Silakan pilih Lokasi / Kampus pengiriman!');
        document.getElementById('custCampus')?.focus();
        return;
    }

    if (custCampus === 'Lainnya' && !custAddressOther) {
        showToast('⚠️ Silakan tuliskan alamat lengkap luar kampus / kosan!');
        document.getElementById('custAddressOther')?.focus();
        return;
    }

    if (custCampus === 'Kampus Stasiun Bumi (SB)' && !custMajor) {
        showToast('⚠️ Silakan pilih jurusan kamu di Kampus Stasiun Bumi (SB)!');
        document.getElementById('custMajor')?.focus();
        return;
    }

    // Validasi Minimal Order 7 Pcs khusus Kampus B dan Kampus C
    if (custCampus === 'Kampus B' || custCampus === 'Kampus C') {
        const totalPcs = getCartMainItemCount();
        if (totalPcs < 7) {
            showToast(`⚠️ Khusus pengantaran ke ${custCampus}, minimal pemesanan adalah 7 pcs! (Saat ini: ${totalPcs} pcs)`);
            updateCampusMinOrderValidation();
            document.getElementById('campusMinOrderNotice')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    let locationSummary = '';
    let majorRecorded = '-';
    if (custCampus === 'Lainnya') {
        locationSummary = `Luar Kampus: ${custAddressOther}`;
    } else if (custCampus === 'Kampus Stasiun Bumi (SB)') {
        locationSummary = `${custCampus} (Jurusan: ${custMajor})`;
        majorRecorded = custMajor;
    } else {
        // Kampus B atau Kampus C
        locationSummary = custCampus;
    }

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    let grandTotal = 0;
    const itemsList = state.cart.map(item => {
        const itemTotal = item.unitPrice * item.qty;
        grandTotal += itemTotal;
        const addonsList = item.addons && item.addons.length > 0 ? ` [Topping: ${item.addons.map(a => a.name).join(', ')}]` : '';
        return `${item.name}${addonsList} (${item.qty}x)`;
    });

    const activeAdmin = state.admins.find(a => a.id === state.selectedAdminId) || state.admins[0];

    // ==============================================================
    // JALUR 1: PEMBAYARAN QRIS (ANTI-PEMBELI FIKTIF)
    // ==============================================================
    if (state.paymentMethod === 'qris') {
        // VALIDASI KETAT: Pembeli wajib melampirkan screenshot bukti bayar
        if (!state.qrisProofDataUrl) {
            showToast('⚠️ Unggah screenshot bukti pembayaran QRIS terlebih dahulu untuk menyelesaikan pesanan!');
            const dropzone = document.getElementById('proofDropzone');
            if (dropzone) {
                dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
                dropzone.classList.add('shake-error');
                setTimeout(() => dropzone.classList.remove('shake-error'), 800);
            }
            return;
        }

        const btnSubmit = document.getElementById('btnSubmitWA');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Memvalidasi Pembayaran & Merekap...`;
        }

        const refNumber = document.getElementById('qrisRefNumber')?.value.trim() || '';
        const notesCombined = `${custNotes !== '-' ? custNotes + ' | ' : ''}Ref QRIS: ${refNumber || 'Tanpa Ref'} (Bukti: ${state.qrisProofFilename})`;

        const orderData = {
            id: `KTC-${Date.now().toString().slice(-6)}`,
            date: dateFormatted,
            time: timeFormatted,
            customerName: custName,
            customerPhone: custPhone,
            campus: custCampus,
            major: majorRecorded,
            customerAddress: locationSummary,
            customerNotes: notesCombined,
            itemsSummary: itemsList.join('; '),
            adminTarget: activeAdmin.fullName,
            totalAmount: grandTotal,
            paymentMethod: 'QRIS (LUNAS - Verified)',
            orderStatus: 'Pesanan Berhasil Masuk',
            proofImage: state.qrisProofDataUrl, // Otomatis tersimpan di spreadsheet pribadi & folder Google Drive
            proofFilename: state.qrisProofFilename
        };

        // Animasi verifikasi sistem & sinkronisasi
        setTimeout(() => {
            saveOrderLocally(orderData);
            syncOrderToSpreadsheet(orderData);

            state.lastVerifiedOrder = {
                ...orderData,
                cartSnapshot: [...state.cart],
                proofDataUrl: state.qrisProofDataUrl,
                proofFilename: state.qrisProofFilename,
                adminName: activeAdmin.name,
                adminWA: state.targetWA
            };

            // Bersihkan keranjang dan input bukti
            state.cart = [];
            updateCartUI();
            removeProofFile();
            const refInput = document.getElementById('qrisRefNumber');
            if (refInput) refInput.value = '';

            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<i class="fa-solid fa-shield-check"></i> Verifikasi Pembayaran & Selesaikan Pesanan`;
            }

            // Tutup keranjang & buka Layar Sukses Pembayaran
            closeCartModal();
            openPaymentSuccessModal(state.lastVerifiedOrder);

            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 160,
                    spread: 85,
                    origin: { y: 0.5 }
                });
            }

            showToast('🎉 Pembayaran Berhasil! Data & Bukti QRIS tersimpan di Spreadsheet.');
        }, 1100);

        return;
    }

    // ==============================================================
    // JALUR 2: BAYAR TUNAI / COD
    // ==============================================================
    const orderData = {
        id: `KTC-${Date.now().toString().slice(-6)}`,
        date: dateFormatted,
        time: timeFormatted,
        customerName: custName,
        customerPhone: custPhone,
        campus: custCampus,
        major: majorRecorded,
        customerAddress: locationSummary,
        customerNotes: custNotes,
        itemsSummary: itemsList.join('; '),
        adminTarget: activeAdmin.fullName,
        totalAmount: grandTotal,
        paymentMethod: 'Bayar Tunai / COD (Pending)',
        orderStatus: 'Pesanan Berhasil Masuk',
        proofImage: null,
        proofFilename: null
    };

    saveOrderLocally(orderData);
    syncOrderToSpreadsheet(orderData);

    const message = generateWAMessage();
    const encodedMessage = encodeURIComponent(message);
    const waURL = `https://wa.me/${state.targetWA}?text=${encodedMessage}`;

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }

    showToast(`🚀 Pesanan COD terdata! Mengalihkan ke WhatsApp ${activeAdmin.fullName}...`);

    setTimeout(() => {
        window.open(waURL, '_blank');
        closeCartModal();
    }, 850);
}

// ==========================================================================
// 7. PAYMENT SUCCESS MODAL & RECEIPT ENGINE
// ==========================================================================

function openPaymentSuccessModal(order) {
    const modal = document.getElementById('paymentSuccessModal');
    if (!modal || !order) return;

    const receiptOrderId = document.getElementById('receiptOrderId');
    const receiptOrderTime = document.getElementById('receiptOrderTime');
    const receiptCustomerName = document.getElementById('receiptCustomerName');
    const receiptAdminName = document.getElementById('receiptAdminName');
    const receiptTotalAmount = document.getElementById('receiptTotalAmount');
    const receiptProofFilename = document.getElementById('receiptProofFilename');

    if (receiptOrderId) receiptOrderId.innerText = order.id;
    if (receiptOrderTime) receiptOrderTime.innerText = `${order.date} • ${order.time}`;
    if (receiptCustomerName) receiptCustomerName.innerText = `${order.customerName} (${order.customerAddress})`;
    if (receiptAdminName) receiptAdminName.innerText = order.adminTarget;
    if (receiptTotalAmount) receiptTotalAmount.innerText = `Rp ${order.totalAmount.toLocaleString('id-ID')}`;
    if (receiptProofFilename) receiptProofFilename.innerText = order.proofFilename || 'bukti_transfer.jpg';

    // Perbarui stepper status progres pemesanan
    updateReceiptTracker(order.orderStatus || 'Pesanan Berhasil Masuk');

    const itemsContainer = document.getElementById('receiptItemsList');
    if (itemsContainer && order.cartSnapshot) {
        itemsContainer.innerHTML = '';
        order.cartSnapshot.forEach(item => {
            const itemRow = document.createElement('div');
            itemRow.className = 'receipt-item-row';
            itemRow.innerHTML = `
                <span><strong>${item.qty}x</strong> ${item.name}</span>
                <span>Rp ${(item.unitPrice * item.qty).toLocaleString('id-ID')}</span>
            `;
            itemsContainer.appendChild(itemRow);
        });
    }

    // Set link tombol WhatsApp Admin
    const waBtn = document.getElementById('successWABtn');
    if (waBtn) {
        const waMsg =
            `Halo Admin ${order.adminName} (Kethai & Co)!
Saya sudah menyelesaikan PEMBAYARAN QRIS untuk pesanan saya:

*STATUS:* SUDAH DIBAYAR / LUNAS (Verified di Web)
*ID PESANAN:* ${order.id}
*NAMA:* ${order.customerName}
*NO. WHATSAPP:* ${order.customerPhone || '-'}
*LOKASI:* ${order.customerAddress}
*RINCIAN:* ${order.itemsSummary}
*TOTAL TERBAYAR:* Rp ${order.totalAmount.toLocaleString('id-ID')}

Tangkapan layar (screenshot) bukti transfer QRIS sudah saya upload di website dan siap saya kirimkan di sini. Mohon segera diproses pengantarannya ya min! Terima kasih.`;
        waBtn.href = `https://wa.me/${order.adminWA}?text=${encodeURIComponent(waMsg)}`;
    }

    modal.classList.add('active');
}

function closeSuccessModalAndReset() {
    document.getElementById('paymentSuccessModal')?.classList.remove('active');
    state.lastVerifiedOrder = null;
    updateCartUI();
}

function downloadReceiptTxt() {
    const order = state.lastVerifiedOrder;
    if (!order) {
        showToast('⚠️ Tidak ada struk pesanan aktif.');
        return;
    }

    const content =
        `==============================================
        STRUK PEMBAYARAN KETHAI & CO
         Ketan Susu Tradisional Modern
==============================================
ID Pesanan   : ${order.id}
Tanggal/Jam  : ${order.date} • ${order.time}
Status       : ${order.paymentMethod} (LUNAS)
Pemesan      : ${order.customerName}
No. WhatsApp : ${order.customerPhone || '-'}
Lokasi/Kosan : ${order.customerAddress}
Admin Bertugas: ${order.adminTarget}
----------------------------------------------
RINCIAN MENU:
${order.itemsSummary.replace(/; /g, '\n')}
----------------------------------------------
TOTAL BAYAR  : Rp ${order.totalAmount.toLocaleString('id-ID')}
Metode       : QRIS Merchant (Verified)
Catatan      : ${order.customerNotes}
==============================================
Data resmi tercatat di Google Spreadsheet Harian.
Terima kasih telah memesan di Kethai & Co! 🙏
==============================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Struk_KethaiCo_${order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 Struk pembayaran digital berhasil diunduh!');
}

// ==========================================================================
// 8. MODALS & TOAST UI HANDLERS
// ==========================================================================

function openCartModal() {
    document.getElementById('cartModal')?.classList.add('active');
    updateQrisAmountDisplay();
    updateCampusMinOrderValidation();
    updateWAPreview();
}

function closeCartModal() {
    document.getElementById('cartModal')?.classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;

    toastMessage.innerText = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3400);
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});
