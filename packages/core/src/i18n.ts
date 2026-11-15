import type { NoticeCode } from './checkout/notices';
import type { PaymentStatus } from './types';

/**
 * Shopper copy. It lives in the Storefront core so that every design, including a Brand design,
 * tells the shopper the same truth about quotes and payments without rewriting it.
 */
export const LOCALES = ['id', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** BCP 47 tag used for number and date formatting. */
export const LOCALE_TAGS: Record<Locale, string> = { id: 'id-ID', en: 'en-ID' };

export interface Messages {
    nav: { products: string; cart: string };
    product: {
        addToCart: string;
        outOfStock: string;
        variant: string;
        quantity: string;
        from: string;
        unavailable: string;
        empty: string;
    };
    cart: {
        title: string;
        empty: string;
        continueShopping: string;
        checkout: string;
        update: string;
        remove: string;
        quantity: string;
    };
    summary: {
        heading: string;
        subtotal: string;
        shipping: string;
        shippingPending: string;
        total: string;
        totalEstimated: string;
        estimatedNote: string;
    };
    checkout: {
        title: string;
        empty: string;
        steps: { contact: string; delivery: string; rates: string; payment: string };
        edit: string;
        contact: {
            heading: string;
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            submit: string;
        };
        delivery: {
            heading: string;
            searchLabel: string;
            searchHint: string;
            search: string;
            noResults: string;
            area: string;
            street: string;
            streetOptional: string;
            submit: string;
        };
        rates: {
            heading: string;
            refresh: string;
            select: string;
            selected: string;
            continue: string;
            chooseFirst: string;
        };
        /** One explicit message per quote state. */
        quote: {
            notReady: string;
            noCoverage: string;
            expired: string;
            unavailableRetry: string;
            unavailable: string;
        };
        payment: {
            heading: string;
            finalTotal: string;
            payWith: string;
            sandbox: string;
            none: string;
            redirectNote: string;
            backToCart: string;
        };
    };
    order: {
        title: string;
        code: string;
        notFound: string;
        status: Record<PaymentStatus, string>;
        detail: Record<PaymentStatus, string>;
        reviewRequired: string;
        continuePayment: string;
        checking: string;
        newCart: string;
        shippingNote: string;
        deliverTo: string;
        courierService: string;
    };
    notices: Record<NoticeCode, string>;
}

const id: Messages = {
    nav: { products: 'Produk', cart: 'Keranjang' },
    product: {
        addToCart: 'Tambah ke keranjang',
        outOfStock: 'Stok habis',
        variant: 'Pilihan',
        quantity: 'Jumlah',
        from: 'Mulai',
        unavailable: 'Produk ini tidak lagi tersedia.',
        empty: 'Belum ada produk.',
    },
    cart: {
        title: 'Keranjang',
        empty: 'Keranjang Anda kosong.',
        continueShopping: 'Lanjut belanja',
        checkout: 'Lanjut ke pembayaran',
        update: 'Perbarui',
        remove: 'Hapus',
        quantity: 'Jumlah',
    },
    summary: {
        heading: 'Ringkasan pesanan',
        subtotal: 'Subtotal',
        shipping: 'Ongkos kirim',
        shippingPending: 'Dihitung setelah alamat diisi',
        total: 'Total',
        totalEstimated: 'Perkiraan total',
        estimatedNote: 'Total akhir dipastikan sebelum Anda membayar.',
    },
    checkout: {
        title: 'Checkout',
        empty: 'Keranjang Anda kosong, jadi belum ada yang bisa dibayar.',
        steps: { contact: 'Kontak', delivery: 'Alamat', rates: 'Pengiriman', payment: 'Pembayaran' },
        edit: 'Ubah',
        contact: {
            heading: 'Data kontak',
            firstName: 'Nama depan',
            lastName: 'Nama belakang',
            email: 'Email',
            phone: 'Nomor telepon',
            submit: 'Simpan dan lanjut',
        },
        delivery: {
            heading: 'Alamat pengiriman',
            searchLabel: 'Cari kecamatan, kota atau kode pos',
            searchHint: 'Contoh: Coblong, Bandung atau 40115',
            search: 'Cari',
            noResults: 'Tidak ada area yang cocok. Coba kata kunci lain.',
            area: 'Pilih area tujuan',
            street: 'Alamat lengkap (jalan, nomor rumah)',
            streetOptional: 'Detail tambahan (opsional)',
            submit: 'Simpan alamat dan lihat ongkir',
        },
        rates: {
            heading: 'Layanan kurir',
            refresh: 'Perbarui ongkos kirim',
            select: 'Pilih layanan ini',
            selected: 'Dipilih',
            continue: 'Lanjut ke pembayaran',
            chooseFirst: 'Pilih satu layanan kurir untuk melanjutkan.',
        },
        quote: {
            notReady: 'Ongkos kirim belum dihitung untuk pesanan ini.',
            noCoverage: 'Tidak ada layanan kurir yang menjangkau alamat ini. Coba alamat lain.',
            expired: 'Ongkos kirim sudah kedaluwarsa. Perbarui untuk melihat harga terbaru.',
            unavailableRetry: 'Ongkos kirim belum bisa diambil saat ini. Coba lagi sebentar lagi.',
            unavailable:
                'Ongkos kirim tidak tersedia untuk pesanan ini. Ini bukan gratis ongkir: periksa keranjang dan alamat Anda.',
        },
        payment: {
            heading: 'Konfirmasi dan bayar',
            finalTotal: 'Total yang harus dibayar',
            payWith: 'Bayar dengan {provider}',
            sandbox: 'Mode uji coba: tidak ada uang sungguhan yang ditagih.',
            none: 'Belum ada metode pembayaran yang tersedia untuk pesanan ini.',
            redirectNote: 'Anda akan diarahkan ke halaman pembayaran {provider}.',
            backToCart: 'Ubah pesanan',
        },
    },
    order: {
        title: 'Pesanan',
        code: 'Kode pesanan',
        notFound: 'Pesanan tidak ditemukan, atau perangkat ini tidak punya akses untuk melihatnya.',
        status: {
            'not-started': 'Pembayaran belum dimulai',
            pending: 'Menunggu pembayaran',
            uncertain: 'Pembayaran sedang diperiksa',
            failed: 'Pembayaran gagal',
            paid: 'Pembayaran diterima',
            cancelled: 'Pembayaran dibatalkan',
            expired: 'Pembayaran kedaluwarsa',
            unknown: 'Pembayaran sedang diperiksa',
        },
        detail: {
            'not-started': 'Pembayaran untuk pesanan ini belum dimulai.',
            pending: 'Kami belum menerima konfirmasi pembayaran. Halaman ini diperbarui otomatis.',
            uncertain:
                'Kami sedang memastikan status pembayaran Anda. Jangan membayar lagi sampai statusnya jelas. Halaman ini diperbarui otomatis.',
            failed: 'Pembayaran tidak berhasil dan Anda tidak ditagih untuk pesanan ini.',
            paid: 'Terima kasih. Pembayaran Anda sudah kami verifikasi.',
            cancelled: 'Pembayaran untuk pesanan ini dibatalkan.',
            expired: 'Batas waktu pembayaran untuk pesanan ini sudah lewat.',
            unknown:
                'Kami sedang memastikan status pembayaran Anda. Jangan membayar lagi sampai statusnya jelas.',
        },
        reviewRequired: 'Pembayaran Anda sedang ditinjau oleh tim kami. Jangan membayar lagi.',
        continuePayment: 'Lanjutkan pembayaran',
        checking: 'Memeriksa status pembayaran…',
        newCart: 'Mulai pesanan baru',
        shippingNote: 'Pengiriman diproses oleh penjual setelah pembayaran diverifikasi.',
        deliverTo: 'Dikirim ke',
        courierService: 'Layanan kurir',
    },
    notices: {
        RECONFIRMATION_REQUIRED: 'Total pesanan berubah. Periksa total terbaru, lalu konfirmasi lagi.',
        SHIPPING_SERVICE_REMOVED: 'Layanan kurir yang Anda pilih tidak lagi tersedia. Pilih layanan lain.',
        SHIPPING_INPUT_CHANGED: 'Data pengiriman berubah. Perbarui ongkos kirim dan konfirmasi lagi.',
        SHIPPING_UNAVAILABLE: 'Ongkos kirim belum bisa dipastikan. Coba bayar lagi sebentar lagi.',
        STOCK_UNAVAILABLE: 'Stok salah satu barang tidak mencukupi. Periksa keranjang Anda.',
        UNSUPPORTED_CURRENCY: 'Mata uang pesanan ini belum didukung untuk pembayaran.',
        AMOUNT_INVALID: 'Total pesanan tidak valid untuk dibayar. Periksa keranjang Anda.',
        ORDER_NOT_READY: 'Pesanan belum siap dibayar. Lengkapi langkah sebelumnya.',
        PAYMENT_METHOD_UNAVAILABLE: 'Metode pembayaran ini sedang tidak tersedia.',
        ACCESS_GRANT_REQUIRED: 'Kami belum bisa mengamankan akses ke pesanan Anda. Coba lagi.',
        INVALID_INPUT: 'Permintaan pembayaran tidak valid. Muat ulang halaman dan coba lagi.',
        IDEMPOTENCY_CONFLICT:
            'Permintaan pembayaran sebelumnya sudah berubah. Periksa total, lalu konfirmasi lagi.',
        PAYMENT_IN_PROGRESS: 'Pembayaran untuk pesanan ini sedang berjalan, jadi pesanan tidak bisa diubah.',
        ACCESS_GRANT_FAILED:
            'Kami belum bisa mengamankan akses ke pesanan Anda, jadi pembayaran belum dimulai. Coba lagi.',
        PAYMENT_START_UNCONFIRMED:
            'Kami belum mendapat jawaban saat memulai pembayaran. Tekan bayar sekali lagi: Anda tidak akan ditagih dua kali.',
        PAYMENT_REDIRECT_REFUSED:
            'Halaman pembayaran tidak bisa dibuka dengan aman. Lihat status pesanan Anda.',
        INSUFFICIENT_STOCK: 'Stok tidak mencukupi untuk jumlah yang Anda minta.',
        ORDER_LIMIT: 'Jumlah barang melebihi batas untuk satu pesanan.',
        ORDER_CHANGE_REFUSED: 'Pesanan tidak bisa diubah pada tahap ini.',
        VARIANT_UNAVAILABLE: 'Barang ini tidak lagi tersedia.',
        EMAIL_CONFLICT: 'Email ini sudah terdaftar. Gunakan email lain untuk checkout sebagai tamu.',
        ALREADY_SIGNED_IN: 'Anda sudah masuk, jadi data kontak diambil dari akun Anda.',
        GUEST_CHECKOUT_DISABLED: 'Checkout sebagai tamu tidak tersedia di toko ini.',
        INELIGIBLE_SHIPPING_METHOD:
            'Layanan kurir itu tidak lagi tersedia. Perbarui ongkos kirim dan pilih lagi.',
        TRANSITION_REFUSED: 'Pesanan belum bisa dilanjutkan. Periksa alamat dan layanan kurir Anda.',
        NO_ACTIVE_ORDER: 'Keranjang Anda kosong.',
        DESTINATION_REJECTED: 'Alamat dan area tujuan tidak cocok. Pilih area lagi dan periksa alamat Anda.',
        RATES_REFRESH_IN_PROGRESS: 'Ongkos kirim sedang dihitung. Coba lagi sebentar lagi.',
        INVALID_FORM: 'Ada isian yang belum lengkap atau tidak valid.',
        SERVICE_UNAVAILABLE: 'Toko sedang tidak bisa dihubungi. Coba lagi sebentar lagi.',
    },
};

const en: Messages = {
    nav: { products: 'Products', cart: 'Cart' },
    product: {
        addToCart: 'Add to cart',
        outOfStock: 'Out of stock',
        variant: 'Option',
        quantity: 'Quantity',
        from: 'From',
        unavailable: 'This product is no longer available.',
        empty: 'No products yet.',
    },
    cart: {
        title: 'Cart',
        empty: 'Your cart is empty.',
        continueShopping: 'Continue shopping',
        checkout: 'Go to checkout',
        update: 'Update',
        remove: 'Remove',
        quantity: 'Quantity',
    },
    summary: {
        heading: 'Order summary',
        subtotal: 'Subtotal',
        shipping: 'Shipping',
        shippingPending: 'Calculated after you enter an address',
        total: 'Total',
        totalEstimated: 'Estimated total',
        estimatedNote: 'The final total is confirmed before you pay.',
    },
    checkout: {
        title: 'Checkout',
        empty: 'Your cart is empty, so there is nothing to pay for yet.',
        steps: { contact: 'Contact', delivery: 'Address', rates: 'Delivery', payment: 'Payment' },
        edit: 'Change',
        contact: {
            heading: 'Contact details',
            firstName: 'First name',
            lastName: 'Last name',
            email: 'Email',
            phone: 'Phone number',
            submit: 'Save and continue',
        },
        delivery: {
            heading: 'Delivery address',
            searchLabel: 'Search district, city or postal code',
            searchHint: 'For example: Coblong, Bandung or 40115',
            search: 'Search',
            noResults: 'No matching area. Try another search.',
            area: 'Choose the destination area',
            street: 'Street address',
            streetOptional: 'Additional details (optional)',
            submit: 'Save address and see delivery rates',
        },
        rates: {
            heading: 'Courier service',
            refresh: 'Refresh delivery rates',
            select: 'Choose this service',
            selected: 'Selected',
            continue: 'Continue to payment',
            chooseFirst: 'Choose a Courier service to continue.',
        },
        quote: {
            notReady: 'Delivery rates have not been calculated for this order yet.',
            noCoverage: 'No Courier service delivers to this address. Try another address.',
            expired: 'These delivery rates have expired. Refresh to see current prices.',
            unavailableRetry: 'Delivery rates could not be fetched right now. Try again in a moment.',
            unavailable:
                'Delivery rates are not available for this order. This is not free shipping: check your cart and address.',
        },
        payment: {
            heading: 'Confirm and pay',
            finalTotal: 'Total to pay',
            payWith: 'Pay with {provider}',
            sandbox: 'Test mode: no real money is charged.',
            none: 'No payment method is available for this order yet.',
            redirectNote: 'You will be taken to the {provider} payment page.',
            backToCart: 'Change order',
        },
    },
    order: {
        title: 'Order',
        code: 'Order code',
        notFound: 'Order not found, or this device does not have access to it.',
        status: {
            'not-started': 'Payment not started',
            pending: 'Waiting for payment',
            uncertain: 'Payment is being checked',
            failed: 'Payment failed',
            paid: 'Payment received',
            cancelled: 'Payment cancelled',
            expired: 'Payment expired',
            unknown: 'Payment is being checked',
        },
        detail: {
            'not-started': 'Payment for this order has not been started.',
            pending: 'We have not received payment confirmation yet. This page updates automatically.',
            uncertain:
                'We are confirming your payment status. Do not pay again until it is clear. This page updates automatically.',
            failed: 'The payment did not go through and you were not charged for this order.',
            paid: 'Thank you. We have verified your payment.',
            cancelled: 'Payment for this order was cancelled.',
            expired: 'The payment window for this order has passed.',
            unknown: 'We are confirming your payment status. Do not pay again until it is clear.',
        },
        reviewRequired: 'Your payment is being reviewed by our team. Do not pay again.',
        continuePayment: 'Continue payment',
        checking: 'Checking payment status…',
        newCart: 'Start a new order',
        shippingNote: 'The seller arranges delivery after payment is verified.',
        deliverTo: 'Deliver to',
        courierService: 'Courier service',
    },
    notices: {
        RECONFIRMATION_REQUIRED: 'Your order total changed. Check the new total, then confirm again.',
        SHIPPING_SERVICE_REMOVED: 'The Courier service you chose is no longer available. Choose another.',
        SHIPPING_INPUT_CHANGED: 'Your delivery details changed. Refresh the rates and confirm again.',
        SHIPPING_UNAVAILABLE: 'Delivery rates could not be confirmed. Try paying again in a moment.',
        STOCK_UNAVAILABLE: 'An item no longer has enough stock. Check your cart.',
        UNSUPPORTED_CURRENCY: 'This order currency is not supported for payment yet.',
        AMOUNT_INVALID: 'The order total is not valid for payment. Check your cart.',
        ORDER_NOT_READY: 'The order is not ready for payment. Complete the earlier steps.',
        PAYMENT_METHOD_UNAVAILABLE: 'This payment method is not available right now.',
        ACCESS_GRANT_REQUIRED: 'We could not secure access to your order yet. Try again.',
        INVALID_INPUT: 'The payment request was not valid. Reload the page and try again.',
        IDEMPOTENCY_CONFLICT:
            'Your earlier payment request has changed. Check the total, then confirm again.',
        PAYMENT_IN_PROGRESS: 'A payment for this order is in progress, so the order cannot be changed.',
        ACCESS_GRANT_FAILED:
            'We could not secure access to your order, so payment was not started. Try again.',
        PAYMENT_START_UNCONFIRMED:
            'We got no answer when starting your payment. Press pay once more: you will not be charged twice.',
        PAYMENT_REDIRECT_REFUSED: 'The payment page could not be opened safely. See your order status.',
        INSUFFICIENT_STOCK: 'There is not enough stock for that quantity.',
        ORDER_LIMIT: 'That is more items than one order allows.',
        ORDER_CHANGE_REFUSED: 'The order cannot be changed at this stage.',
        VARIANT_UNAVAILABLE: 'This item is no longer available.',
        EMAIL_CONFLICT: 'This email already has an account. Use another email to check out as a guest.',
        ALREADY_SIGNED_IN: 'You are signed in, so contact details come from your account.',
        GUEST_CHECKOUT_DISABLED: 'Guest checkout is not available in this store.',
        INELIGIBLE_SHIPPING_METHOD:
            'That Courier service is no longer available. Refresh the rates and choose again.',
        TRANSITION_REFUSED: 'The order cannot continue yet. Check your address and Courier service.',
        NO_ACTIVE_ORDER: 'Your cart is empty.',
        DESTINATION_REJECTED:
            'The address and destination area do not match. Choose the area again and check your address.',
        RATES_REFRESH_IN_PROGRESS: 'Delivery rates are being calculated. Try again in a moment.',
        INVALID_FORM: 'Some fields are missing or not valid.',
        SERVICE_UNAVAILABLE: 'The store cannot be reached right now. Try again in a moment.',
    },
};

const CATALOGUES: Record<Locale, Messages> = { id, en };

export function getMessages(locale: Locale): Messages {
    return CATALOGUES[locale];
}

/** Replaces `{name}` placeholders. */
export function fill(template: string, values: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
