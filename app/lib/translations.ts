export const AVAILABLE_LANGUAGES = [
  { code: "en", labelKey: "English" },
  { code: "es", labelKey: "Spanish" },
] as const;

export type LanguageCode = (typeof AVAILABLE_LANGUAGES)[number]["code"];

export type TranslationKey = string;

export type TranslationDictionary = Record<TranslationKey, string>;

export const translations: Record<LanguageCode, TranslationDictionary> = {
  en: {
    "Bitcoin Lightning Wallet": "Bitcoin Lightning Wallet",
    Username: "Username",
    Password: "Password",
    "Forgot Password?": "Forgot Password?",
    "Signing In...": "Signing In...",
    "Sign In": "Sign In",
    OR: "OR",
    "Create new account": "Create new account",
    "Passwords do not match.": "Passwords do not match.",
    "Enter verification code": "Enter verification code",
    "Create a new account": "Create a new account",
    Name: "Name",
    Email: "Email",
    "Confirm Password": "Confirm Password",
    Alias: "Alias",
    "Registering...": "Registering...",
    Register: "Register",
    "Verification Code": "Verification Code",
    "Verifying...": "Verifying...",
    Verify: "Verify",
    "Reset your password": "Reset your password",
    "A password reset code has been sent to your email.":
      "A password reset code has been sent to your email.",
    "Password has been reset successfully. You can now log in.":
      "Password has been reset successfully. You can now log in.",
    "Enter your email": "Enter your email",
    "Sending...": "Sending...",
    "Send Reset Code": "Send Reset Code",
    "New Password": "New Password",
    "Resetting...": "Resetting...",
    "Reset Password": "Reset Password",
    "Failed to fetch data: {error}": "Failed to fetch data: {error}",
    "No description": "No description",
    "Payment Received": "Payment Received",
    Receive: "Receive",
    Send: "Send",
    "Recent Transactions": "Recent Transactions",
    "Click to change unit": "Click to change unit",
    "No transactions found in the last 30 days.":
      "No transactions found in the last 30 days.",
    "See more": "See more",
    "Pending...": "Pending...",
    Failed: "Failed",
    Settings: "Settings",
    "Preferred Currency": "Preferred Currency",
    "The selected currency will be used to show equivalent values in the application.":
      "The selected currency will be used to show equivalent values in the application.",
    Language: "Language",
    "Choose the interface language. Changes take effect immediately.":
      "Choose the interface language. Changes take effect immediately.",
    "Invoice Details": "Invoice Details",
    "Amount:": "Amount:",
    "Description:": "Description:",
    "Paying...": "Paying...",
    "Pay {amount} sats": "Pay {amount} sats",
    "LNURL Payment": "LNURL Payment",
    "Amount ({min} - {max} sats)": "Amount ({min} - {max} sats)",
    "Comment (optional, max {count} chars)":
      "Comment (optional, max {count} chars)",
    "Processing...": "Processing...",
    Pay: "Pay",
    "Amount (sats)": "Amount (sats)",
    "Fee: {fee} sats": "Fee: {fee} sats",
    "Total: {total} sats": "Total: {total} sats",
    "Confirm and Send": "Confirm and Send",
    "Estimating Fee...": "Estimating Fee...",
    Continue: "Continue",
    Details: "Details",
    "Send Payment": "Send Payment",
    "Paste Invoice, LNURL, Address, or Alias":
      "Paste Invoice, LNURL, Address, or Alias",
    "Decoding...": "Decoding...",
    Decode: "Decode",
    "Scan QR Code": "Scan QR Code",
    "Payment initiated! Status: {status}.":
      "Payment initiated! Status: {status}.",
    "Unsupported or invalid format": "Unsupported or invalid format",
    "Payment type not supported yet.": "Payment type not supported yet.",
    Lightning: "Lightning",
    Bitcoin: "Bitcoin",
    "Request Amount": "Request Amount",
    "Lightning Address": "Lightning Address",
    "Copy LNURL": "Copy LNURL",
    Share: "Share",
    "My Lightning Address": "My Lightning Address",
    "You can send me Bitcoin on the Lightning Network using this address: {address}":
      "You can send me Bitcoin on the Lightning Network using this address: {address}",
    "Bitcoin Address": "Bitcoin Address",
    "Copy Bitcoin Address": "Copy Bitcoin Address",
    "My Bitcoin Address": "My Bitcoin Address",
    "You can send me Bitcoin On Chain using this address: {address}":
      "You can send me Bitcoin On Chain using this address: {address}",
    "Memo (optional)": "Memo (optional)",
    "Memo must be 500 characters or fewer.":
      "Memo must be 500 characters or fewer.",
    "Generating...": "Generating...",
    "Generate Invoice": "Generate Invoice",
    "Could not access camera. Please check permissions and try again.":
      "Could not access camera. Please check permissions and try again.",
    Close: "Close",
    Back: "Back",
    English: "English",
    Spanish: "Spanish",
    "Google credential was not received.": "Google credential was not received.",
    "Amount must be between {min} and {max} sats.":
      "Amount must be between {min} and {max} sats.",
    "Refresh wallet data": "Refresh wallet data",
    "Refreshing wallet data": "Refreshing wallet data",
    "Log out": "Log out",
    Balance: "Balance",
    "Show balance": "Show balance",
    "Hide balance": "Hide balance",
    "Change display unit. Current unit: {unit}":
      "Change display unit. Current unit: {unit}",
    "1 BTC ≈ {price}": "1 BTC ≈ {price}",
    "Loading wallet": "Loading wallet",
    "Loading settings": "Loading settings",
    Transfer: "Transfer",
    "Receive options": "Receive options",
    "Copy invoice": "Copy invoice",
    "Invoice QR Code": "Invoice QR Code",
    Wallet: "Wallet",
    Requests: "Requests",
    "Dashboard sections": "Dashboard sections",
    "New Request": "New Request",
    "Create Request": "Create Request",
    "Creating request...": "Creating request...",
    "Enter a positive integer amount in sats.":
      "Enter a positive integer amount in sats.",
    "Choose a valid expiry.": "Choose a valid expiry.",
    "Failed to create request.": "Failed to create request.",
    "Expires in": "Expires in",
    "1 hour": "1 hour",
    "24 hours": "24 hours",
    "7 days": "7 days",
    Pending: "Pending",
    Preparing: "Preparing",
    Cancelling: "Cancelling",
    Paid: "Paid",
    Expired: "Expired",
    Cancelled: "Cancelled",
    "Loading requests": "Loading requests",
    "Loading requests...": "Loading requests...",
    "Failed to load requests.": "Failed to load requests.",
    "No payment requests yet.": "No payment requests yet.",
    "Create a request to share a Lightning invoice link.":
      "Create a request to share a Lightning invoice link.",
    "Payment requests": "Payment requests",
    "View request for {amount}": "View request for {amount}",
    "Loading...": "Loading...",
    "Load more": "Load more",
    "Request Details": "Request Details",
    "Loading request...": "Loading request...",
    "Failed to load request.": "Failed to load request.",
    "Checking status": "Checking status",
    Retry: "Retry",
    Created: "Created",
    Expires: "Expires",
    "Paid at": "Paid at",
    "Cancelled at": "Cancelled at",
    "Copy share link": "Copy share link",
    "Link copied": "Link copied",
    "Invoice copied": "Invoice copied",
    "Could not copy to clipboard.": "Could not copy to clipboard.",
    "Payment Request": "Payment Request",
    "Pay this Lightning request": "Pay this Lightning request",
    "Cancel Request": "Cancel Request",
    "Cancel this payment request? This cannot be undone.":
      "Cancel this payment request? This cannot be undone.",
    "Keep Request": "Keep Request",
    "Confirm Cancel": "Confirm Cancel",
    "Cancelling...": "Cancelling...",
    "Request cancelled": "Request cancelled",
    "Failed to cancel request.": "Failed to cancel request.",
    "This create request conflicts with a previous attempt. Change the form or try again.":
      "This create request conflicts with a previous attempt. Change the form or try again.",
    "Loading payment": "Loading payment",
    "Loading payment...": "Loading payment...",
    "Failed to load payment.": "Failed to load payment.",
    "Payment request not found.": "Payment request not found.",
    "This request has been paid.": "This request has been paid.",
    "This payment request has expired.": "This payment request has expired.",
    "This payment request has expired. Confirming status...":
      "This payment request has expired. Confirming status...",
    "This payment request was cancelled.":
      "This payment request was cancelled.",
    "This payment request is being prepared.":
      "This payment request is being prepared.",
    "This payment request is being cancelled.":
      "This payment request is being cancelled.",
    "This payment request failed.": "This payment request failed.",
    "This payment request is unavailable.":
      "This payment request is unavailable.",
    "Open in Wallet": "Open in Wallet",
    "A 10,000-sat bond is reserved during the withdrawal and returned when it settles.":
      "A 10,000-sat bond is reserved during the withdrawal and returned when it settles.",
    "A fresh address for each deposit — best for privacy. Use the same address only once.":
      "A fresh address for each deposit — best for privacy. Use the same address only once.",
    "A self-custody Bitcoin wallet. You hold your keys — Aratiri can't recover them, and can't take them.":
      "A self-custody Bitcoin wallet. You hold your keys — Aratiri can't recover them, and can't take them.",
    "Amount (sats) — optional, any amount":
      "Amount (sats) — optional, any amount",
    "Amount must be greater than the fee ({fee} sats) when the fee is deducted from the withdrawal.":
      "Amount must be greater than the fee ({fee} sats) when the fee is deducted from the withdrawal.",
    "Aratiri holds your keys.": "Aratiri holds your keys.",
    "Backup phrase": "Backup phrase",
    "Backup status": "Backup status",
    "Backup verified — you have a written copy of your phrase.":
      "Backup verified — you have a written copy of your phrase.",
    "Balance as of last sync. Unlock for live data and signing.":
      "Balance as of last sync. Unlock for live data and signing.",
    "Balance hidden while locked — unlock to view.":
      "Balance hidden while locked — unlock to view.",
    Cancel: "Cancel",
    "Check it matches the address you expect before continuing. A wrong phrase opens a different wallet.":
      "Check it matches the address you expect before continuing. A wrong phrase opens a different wallet.",
    "Checking phrase...": "Checking phrase...",
    Completed: "Completed",
    "Confirm address": "Confirm address",
    "Confirm forget": "Confirm forget",
    Copied: "Copied",
    "Copy address": "Copy address",
    "Copy phrase": "Copy phrase",
    "Could not generate a deposit address.":
      "Could not generate a deposit address.",
    "Could not generate an invoice.": "Could not generate an invoice.",
    "Create a Spark wallet": "Create a Spark wallet",
    Custodial: "Custodial",
    Deposit: "Deposit",
    "Deduct fee from withdrawal amount (recipient gets amount minus fee).":
      "Deduct fee from withdrawal amount (recipient gets amount minus fee).",
    "Deposit Bitcoin": "Deposit Bitcoin",
    "Deposit address": "Deposit address",
    "Don't screenshot. Don't paste into chat. Write it down now.":
      "Don't screenshot. Don't paste into chat. Write it down now.",
    "Enter an amount in sats.": "Enter an amount in sats.",
    "Each word must be lower-case letters (no spaces or symbols).":
      "Each word must be lower-case letters (no spaces or symbols).",
    "Enter your backup phrase. Words are lower-case letters only.":
      "Enter your backup phrase. Words are lower-case letters only.",
    "Estimating...": "Estimating...",
    "Failed to create wallet.": "Failed to create wallet.",
    "Failed to forget wallet.": "Failed to forget wallet.",
    "Failed to lock wallet.": "Failed to lock wallet.",
    "Failed to restore wallet.": "Failed to restore wallet.",
    "Failed to unlock wallet.": "Failed to unlock wallet.",
    "Failed to update privacy mode.": "Failed to update privacy mode.",
    "Fee quote unavailable.": "Fee quote unavailable.",
    "Forget this wallet": "Forget this wallet",
    "Forgetting is not a backup. If you lose your phrase, your funds are gone forever.":
      "Forgetting is not a backup. If you lose your phrase, your funds are gone forever.",
    "Forgetting...": "Forgetting...",
    "Generate another": "Generate another",
    "Generating address...": "Generating address...",
    "I've written it down": "I've written it down",
    "I've written it down — mark as backed up":
      "I've written it down — mark as backed up",
    "Keep your keys with Spark": "Keep your keys with Spark",
    "Lightning invoice": "Lightning invoice",
    "LNURL callback returned an invalid invoice.":
      "LNURL callback returned an invalid invoice.",
    "LNURL invoice amount ({invoice} sats) does not match the amount you entered ({entered} sats).":
      "LNURL invoice amount ({invoice} sats) does not match the amount you entered ({entered} sats).",
    "Lock wallet": "Lock wallet",
    "Locking...": "Locking...",
    "Mark as backed up": "Mark as backed up",
    "Maximum fee cap": "Maximum fee cap",
    "My Spark deposit address": "My Spark deposit address",
    "Network & account": "Network & account",
    "No transactions found.": "No transactions found.",
    "Not backed up yet. Your phrase has not been verified.":
      "Not backed up yet. Your phrase has not been verified.",
    "One permanent address. Its key is shared with the payment operator, so single-use addresses are more private.":
      "One permanent address. Its key is shared with the payment operator, so single-use addresses are more private.",
    "Paid from your Spark wallet. The invoice is fetched in your browser, then paid with your keys.":
      "Paid from your Spark wallet. The invoice is fetched in your browser, then paid with your keys.",
    "Paste Invoice, LNURL, Bitcoin or Spark address, or Alias":
      "Paste Invoice, LNURL, Bitcoin or Spark address, or Alias",
    "Pick the word at position {position} of your backup phrase.":
      "Pick the word at position {position} of your backup phrase.",
    "Privacy mode": "Privacy mode",
    "Privacy mode off. Your balance is visible in the locked view.":
      "Privacy mode off. Your balance is visible in the locked view.",
    "Privacy mode on. Your balance is hidden until you unlock this wallet.":
      "Privacy mode on. Your balance is hidden until you unlock this wallet.",
    "Privacy on": "Privacy on",
    "Re-estimate Fee": "Re-estimate Fee",
    "Remove from this device": "Remove from this device",
    "Restore a Spark wallet": "Restore a Spark wallet",
    "Restore a wallet": "Restore a wallet",
    "Restore this wallet": "Restore this wallet",
    "Required sats (spend + 10,000-sat bond) exceed your available balance of {available} sats.":
      "Required sats (spend + 10,000-sat bond) exceed your available balance of {available} sats.",
    "Restoring...": "Restoring...",
    Reusable: "Reusable",
    "Self-custody": "Self-custody",
    "Self-custody wallet": "Self-custody wallet",
    "Send {amount} sats": "Send {amount} sats",
    "Send to a Spark wallet — 0 fee, instant.":
      "Send to a Spark wallet — 0 fee, instant.",
    "Single-use": "Single-use",
    Spark: "Spark",
    "Spark fee (0.25% + routing)": "Spark fee (0.25% + routing)",
    "Spark transfer": "Spark transfer",
    Taproot: "Taproot",
    "That doesn't look like a valid backup phrase. Check each word.":
      "That doesn't look like a valid backup phrase. Check each word.",
    "That's not the word at position {position}. Try again.":
      "That's not the word at position {position}. Try again.",
    "The estimated fee exceeds your cap. Payment will be rejected above this cap.":
      "The estimated fee exceeds your cap. Payment will be rejected above this cap.",
    "This fee quote has expired. Go back and re-estimate the fee.":
      "This fee quote has expired. Go back and re-estimate the fee.",
    "This fee quote has expired. Re-estimate to get fresh fees.":
      "This fee quote has expired. Re-estimate to get fresh fees.",
    "This is the wallet you're restoring:":
      "This is the wallet you're restoring:",
    "This wallet hides its balance from third parties. Enter your backup phrase to unlock it.":
      "This wallet hides its balance from third parties. Enter your backup phrase to unlock it.",
    "This wallet is yours alone.": "This wallet is yours alone.",
    "Total (amount + fee + 10,000-sat bond) exceeds your available balance of {available} sats.":
      "Total (amount + fee + 10,000-sat bond) exceeds your available balance of {available} sats.",
    "Type {address} to confirm.": "Type {address} to confirm.",
    "Unlock Spark wallet": "Unlock Spark wallet",
    "Unlock wallet": "Unlock wallet",
    "Unlock your wallet to generate a deposit address.":
      "Unlock your wallet to generate a deposit address.",
    "Unlock your wallet to generate an invoice.":
      "Unlock your wallet to generate an invoice.",
    "Verify backup phrase": "Verify backup phrase",
    "Wallet locked. The mnemonic was cleared from memory.":
      "Wallet locked. The mnemonic was cleared from memory.",
    "Wallet restored.": "Wallet restored.",
    "Wallet spends {amount} sats + a 10,000-sat bond (returned on settle). Recipient receives amount minus fee.":
      "Wallet spends {amount} sats + a 10,000-sat bond (returned on settle). Recipient receives amount minus fee.",
    "Wallet spends {total} sats (amount + fee) + a 10,000-sat bond (returned on settle). Recipient receives the full amount.":
      "Wallet spends {total} sats (amount + fee) + a 10,000-sat bond (returned on settle). Recipient receives the full amount.",
    "Wallet type": "Wallet type",
    "When locked, your balance stays readable on this device. Turning privacy on hides it until you unlock.":
      "When locked, your balance stays readable on this device. Turning privacy on hides it until you unlock.",
    Withdrawal: "Withdrawal",
    "Withdrawal speed": "Withdrawal speed",
    Word: "Word",
    "Write down your backup phrase in order. Keep it offline.":
      "Write down your backup phrase in order. Keep it offline.",
    "You hold your keys. Aratiri can't recover them.":
      "You hold your keys. Aratiri can't recover them.",
    "You pay the network fee on the sending side.":
      "You pay the network fee on the sending side.",
    "Your 12-word backup phrase is the only way to access it. If you lose it, no one — not even Aratiri — can help you recover it.":
      "Your 12-word backup phrase is the only way to access it. If you lose it, no one — not even Aratiri — can help you recover it.",
    "Your Spark wallet is ready. Here is your address:":
      "Your Spark wallet is ready. Here is your address:",
    "Your backup is verified.": "Your backup is verified.",
    "Your balance isn't visible to third parties or in the locked view. It shows only after you unlock this wallet.":
      "Your balance isn't visible to third parties or in the locked view. It shows only after you unlock this wallet.",
    "Your device clock looks wrong. Check that the time and timezone are correct, then try again.":
      "Your device clock looks wrong. Check that the time and timezone are correct, then try again.",
    "≈ days": "≈ days",
    "≈ hours": "≈ hours",
    "≈ minutes": "≈ minutes",
    "≈ {fee} sats": "≈ {fee} sats",
  },
  es: {
    "Bitcoin Lightning Wallet": "Billetera Lightning de Bitcoin",
    Username: "Nombre de usuario",
    Password: "Contraseña",
    "Forgot Password?": "¿Olvidaste tu contraseña?",
    "Signing In...": "Iniciando sesión...",
    "Sign In": "Iniciar sesión",
    OR: "O",
    "Create new account": "Crear nueva cuenta",
    "Passwords do not match.": "Las contraseñas no coinciden.",
    "Enter verification code": "Ingresa el código de verificación",
    "Create a new account": "Crea una nueva cuenta",
    Name: "Nombre",
    Email: "Correo electrónico",
    "Confirm Password": "Confirmar contraseña",
    Alias: "Alias",
    "Registering...": "Registrando...",
    Register: "Registrarse",
    "Verification Code": "Código de verificación",
    "Verifying...": "Verificando...",
    Verify: "Verificar",
    "Reset your password": "Restablece tu contraseña",
    "A password reset code has been sent to your email.":
      "Se envió un código de restablecimiento a tu correo electrónico.",
    "Password has been reset successfully. You can now log in.":
      "La contraseña se restableció correctamente. Ya puedes iniciar sesión.",
    "Enter your email": "Ingresa tu correo electrónico",
    "Sending...": "Enviando...",
    "Send Reset Code": "Enviar código",
    "New Password": "Nueva contraseña",
    "Resetting...": "Restableciendo...",
    "Reset Password": "Restablecer contraseña",
    "Failed to fetch data: {error}":
      "No se pudieron obtener los datos: {error}",
    "No description": "Sin descripción",
    "Payment Received": "Pago recibido",
    Receive: "Recibir",
    Send: "Enviar",
    "Recent Transactions": "Transacciones recientes",
    "Click to change unit": "Haz clic para cambiar la unidad",
    "No transactions found in the last 30 days.":
      "No se encontraron transacciones en los últimos 30 días.",
    "See more": "Ver más",
    "Pending...": "Pendiente...",
    Failed: "Fallido",
    Settings: "Configuración",
    "Preferred Currency": "Moneda preferida",
    "The selected currency will be used to show equivalent values in the application.":
      "La moneda seleccionada se usará para mostrar valores equivalentes en la aplicación.",
    Language: "Idioma",
    "Choose the interface language. Changes take effect immediately.":
      "Elige el idioma de la interfaz. Los cambios se aplican de inmediato.",
    "Invoice Details": "Detalles de la factura",
    "Amount:": "Monto:",
    "Description:": "Descripción:",
    "Paying...": "Pagando...",
    "Pay {amount} sats": "Pagar {amount} sats",
    "LNURL Payment": "Pago LNURL",
    "Amount ({min} - {max} sats)": "Monto ({min} - {max} sats)",
    "Comment (optional, max {count} chars)":
      "Comentario (opcional, máx. {count} caracteres)",
    "Processing...": "Procesando...",
    Pay: "Pagar",
    "Amount (sats)": "Monto (sats)",
    "Fee: {fee} sats": "Comisión: {fee} sats",
    "Total: {total} sats": "Total: {total} sats",
    "Confirm and Send": "Confirmar y enviar",
    "Estimating Fee...": "Estimando comisión...",
    Continue: "Continuar",
    Details: "Detalles",
    "Send Payment": "Enviar pago",
    "Paste Invoice, LNURL, Address, or Alias":
      "Pega la factura, LNURL, dirección o alias",
    "Decoding...": "Decodificando...",
    Decode: "Decodificar",
    "Scan QR Code": "Escanear código QR",
    "Payment initiated! Status: {status}.":
      "Pago iniciado. Estado: {status}.",
    "Unsupported or invalid format": "Formato no compatible o inválido",
    "Payment type not supported yet.": "Tipo de pago no soportado todavía.",
    Lightning: "Lightning",
    Bitcoin: "Bitcoin",
    "Request Amount": "Solicitar monto",
    "Lightning Address": "Dirección Lightning",
    "Copy LNURL": "Copiar LNURL",
    Share: "Compartir",
    "My Lightning Address": "Mi dirección Lightning",
    "You can send me Bitcoin on the Lightning Network using this address: {address}":
      "Puedes enviarme Bitcoin en la red Lightning usando esta dirección: {address}",
    "Bitcoin Address": "Dirección Bitcoin",
    "Copy Bitcoin Address": "Copiar dirección de Bitcoin",
    "My Bitcoin Address": "Mi dirección de Bitcoin",
    "You can send me Bitcoin On Chain using this address: {address}":
      "Puedes enviarme Bitcoin on-chain usando esta dirección: {address}",
    "Memo (optional)": "Nota (opcional)",
    "Memo must be 500 characters or fewer.":
      "La nota debe tener 500 caracteres o menos.",
    "Generating...": "Generando...",
    "Generate Invoice": "Generar factura",
    "Could not access camera. Please check permissions and try again.":
      "No se pudo acceder a la cámara. Revisa los permisos e inténtalo de nuevo.",
    Close: "Cerrar",
    Back: "Volver",
    English: "Inglés",
    Spanish: "Español",
    "Google credential was not received.":
      "No se recibió la credencial de Google.",
    "Amount must be between {min} and {max} sats.":
      "El monto debe estar entre {min} y {max} sats.",
    "Refresh wallet data": "Actualizar datos de la billetera",
    "Refreshing wallet data": "Actualizando datos de la billetera",
    "Log out": "Cerrar sesión",
    Balance: "Saldo",
    "Show balance": "Mostrar saldo",
    "Hide balance": "Ocultar saldo",
    "Change display unit. Current unit: {unit}":
      "Cambiar unidad de visualización. Unidad actual: {unit}",
    "1 BTC ≈ {price}": "1 BTC ≈ {price}",
    "Loading wallet": "Cargando billetera",
    "Loading settings": "Cargando configuración",
    Transfer: "Transferencia",
    "Receive options": "Opciones de recepción",
    "Copy invoice": "Copiar factura",
    "Invoice QR Code": "Código QR de la factura",
    Wallet: "Billetera",
    Requests: "Solicitudes",
    "Dashboard sections": "Secciones del panel",
    "New Request": "Nueva solicitud",
    "Create Request": "Crear solicitud",
    "Creating request...": "Creando solicitud...",
    "Enter a positive integer amount in sats.":
      "Ingresa un monto entero positivo en sats.",
    "Choose a valid expiry.": "Elige un vencimiento válido.",
    "Failed to create request.": "No se pudo crear la solicitud.",
    "Expires in": "Vence en",
    "1 hour": "1 hora",
    "24 hours": "24 horas",
    "7 days": "7 días",
    Pending: "Pendiente",
    Preparing: "Preparando",
    Cancelling: "Cancelando",
    Paid: "Pagada",
    Expired: "Vencida",
    Cancelled: "Cancelada",
    "Loading requests": "Cargando solicitudes",
    "Loading requests...": "Cargando solicitudes...",
    "Failed to load requests.": "No se pudieron cargar las solicitudes.",
    "No payment requests yet.": "Aún no hay solicitudes de pago.",
    "Create a request to share a Lightning invoice link.":
      "Crea una solicitud para compartir un enlace de factura Lightning.",
    "Payment requests": "Solicitudes de pago",
    "View request for {amount}": "Ver solicitud de {amount}",
    "Loading...": "Cargando...",
    "Load more": "Cargar más",
    "Request Details": "Detalles de la solicitud",
    "Loading request...": "Cargando solicitud...",
    "Failed to load request.": "No se pudo cargar la solicitud.",
    "Checking status": "Comprobando estado",
    Retry: "Reintentar",
    Created: "Creada",
    Expires: "Vence",
    "Paid at": "Pagada el",
    "Cancelled at": "Cancelada el",
    "Copy share link": "Copiar enlace para compartir",
    "Link copied": "Enlace copiado",
    "Invoice copied": "Factura copiada",
    "Could not copy to clipboard.": "No se pudo copiar al portapapeles.",
    "Payment Request": "Solicitud de pago",
    "Pay this Lightning request": "Paga esta solicitud Lightning",
    "Cancel Request": "Cancelar solicitud",
    "Cancel this payment request? This cannot be undone.":
      "¿Cancelar esta solicitud de pago? Esta acción no se puede deshacer.",
    "Keep Request": "Mantener solicitud",
    "Confirm Cancel": "Confirmar cancelación",
    "Cancelling...": "Cancelando...",
    "Request cancelled": "Solicitud cancelada",
    "Failed to cancel request.": "No se pudo cancelar la solicitud.",
    "This create request conflicts with a previous attempt. Change the form or try again.":
      "Esta creación entra en conflicto con un intento anterior. Cambia el formulario o inténtalo de nuevo.",
    "Loading payment": "Cargando pago",
    "Loading payment...": "Cargando pago...",
    "Failed to load payment.": "No se pudo cargar el pago.",
    "Payment request not found.": "Solicitud de pago no encontrada.",
    "This request has been paid.": "Esta solicitud ya fue pagada.",
    "This payment request has expired.": "Esta solicitud de pago ha vencido.",
    "This payment request has expired. Confirming status...":
      "Esta solicitud de pago ha vencido. Confirmando estado...",
    "This payment request was cancelled.":
      "Esta solicitud de pago fue cancelada.",
    "This payment request is being prepared.":
      "Esta solicitud de pago se está preparando.",
    "This payment request is being cancelled.":
      "Esta solicitud de pago se está cancelando.",
    "This payment request failed.": "Esta solicitud de pago falló.",
    "This payment request is unavailable.":
      "Esta solicitud de pago no está disponible.",
    "Open in Wallet": "Abrir en billetera",
    "A 10,000-sat bond is reserved during the withdrawal and returned when it settles.":
      "Durante el retiro se reserva un depósito de garantía de 10.000 sats que se devuelve al completarse.",
    "A fresh address for each deposit — best for privacy. Use the same address only once.":
      "Una dirección nueva para cada depósito, lo mejor para tu privacidad. Usa la misma dirección solo una vez.",
    "A self-custody Bitcoin wallet. You hold your keys — Aratiri can't recover them, and can't take them.":
      "Una billetera de Bitcoin con autocustodia. Tus claves están en tus manos: Aratiri no puede recuperarlas ni tomarlas.",
    "Amount (sats) — optional, any amount":
      "Monto (sats): opcional, cualquier monto",
    "Amount must be greater than the fee ({fee} sats) when the fee is deducted from the withdrawal.":
      "El monto debe ser mayor que la comisión ({fee} sats) cuando la comisión se descuenta del retiro.",
    "Aratiri holds your keys.": "Aratiri guarda tus claves.",
    "Backup phrase": "Frase de respaldo",
    "Backup status": "Estado del respaldo",
    "Backup verified — you have a written copy of your phrase.":
      "Respaldo verificado: tienes una copia escrita de tu frase.",
    "Balance as of last sync. Unlock for live data and signing.":
      "Saldo según la última sincronización. Desbloquea para ver datos en vivo y firmar.",
    "Balance hidden while locked — unlock to view.":
      "Saldo oculto mientras esté bloqueada: desbloquea para verlo.",
    Cancel: "Cancelar",
    "Check it matches the address you expect before continuing. A wrong phrase opens a different wallet.":
      "Verifica que coincida con la dirección que esperas antes de continuar. Una frase incorrecta abre otra billetera.",
    "Checking phrase...": "Comprobando la frase...",
    Completed: "Completado",
    "Confirm address": "Confirmar dirección",
    "Confirm forget": "Confirmar olvido",
    Copied: "Copiado",
    "Copy address": "Copiar dirección",
    "Copy phrase": "Copiar frase",
    "Could not generate a deposit address.":
      "No se pudo generar una dirección de depósito.",
    "Could not generate an invoice.": "No se pudo generar una factura.",
    "Create a Spark wallet": "Crear una billetera Spark",
    Custodial: "Custodiada",
    Deposit: "Depósito",
    "Deduct fee from withdrawal amount (recipient gets amount minus fee).":
      "Descontar la comisión del monto del retiro (el destinatario recibe el monto menos la comisión).",
    "Deposit Bitcoin": "Depositar Bitcoin",
    "Deposit address": "Dirección de depósito",
    "Don't screenshot. Don't paste into chat. Write it down now.":
      "No tomes capturas de pantalla. No lo pegues en un chat. Escríbelo ahora.",
    "Enter an amount in sats.": "Ingresa un monto en sats.",
    "Each word must be lower-case letters (no spaces or symbols).":
      "Cada palabra debe tener solo letras minúsculas (sin espacios ni símbolos).",
    "Enter your backup phrase. Words are lower-case letters only.":
      "Ingresa tu frase de respaldo. Solo palabras en minúsculas.",
    "Estimating...": "Estimando...",
    "Failed to create wallet.": "No se pudo crear la billetera.",
    "Failed to forget wallet.": "No se pudo olvidar la billetera.",
    "Failed to lock wallet.": "No se pudo bloquear la billetera.",
    "Failed to restore wallet.": "No se pudo restaurar la billetera.",
    "Failed to unlock wallet.": "No se pudo desbloquear la billetera.",
    "Failed to update privacy mode.":
      "No se pudo actualizar el modo de privacidad.",
    "Fee quote unavailable.": "Cotización de comisión no disponible.",
    "Forget this wallet": "Olvidar esta billetera",
    "Forgetting is not a backup. If you lose your phrase, your funds are gone forever.":
      "Olvidar no es un respaldo. Si pierdes tu frase, tus fondos se pierden para siempre.",
    "Forgetting...": "Olvidando...",
    "Generate another": "Generar otra",
    "Generating address...": "Generando dirección...",
    "I've written it down": "Lo he escrito",
    "I've written it down — mark as backed up":
      "Lo he escrito: marcar como respaldado",
    "Keep your keys with Spark": "Mantén tus claves con Spark",
    "Lightning invoice": "Factura Lightning",
    "LNURL callback returned an invalid invoice.":
      "El callback LNURL devolvió una factura inválida.",
    "LNURL invoice amount ({invoice} sats) does not match the amount you entered ({entered} sats).":
      "El monto de la factura LNURL ({invoice} sats) no coincide con el monto que ingresaste ({entered} sats).",
    "Lock wallet": "Bloquear billetera",
    "Locking...": "Bloqueando...",
    "Mark as backed up": "Marcar como respaldado",
    "Maximum fee cap": "Límite máximo de comisión",
    "My Spark deposit address": "Mi dirección de depósito Spark",
    "Network & account": "Red y cuenta",
    "No transactions found.": "No se encontraron transacciones.",
    "Not backed up yet. Your phrase has not been verified.":
      "Aún no respaldada. Tu frase no ha sido verificada.",
    "One permanent address. Its key is shared with the payment operator, so single-use addresses are more private.":
      "Una dirección permanente. Su clave se comparte con el operador de pagos, por eso las direcciones de un solo uso son más privadas.",
    "Paid from your Spark wallet. The invoice is fetched in your browser, then paid with your keys.":
      "Se paga desde tu billetera Spark. La factura se obtiene en tu navegador y luego se paga con tus claves.",
    "Paste Invoice, LNURL, Bitcoin or Spark address, or Alias":
      "Pega una factura, LNURL, dirección Bitcoin o Spark, o un alias",
    "Pick the word at position {position} of your backup phrase.":
      "Elige la palabra en la posición {position} de tu frase de respaldo.",
    "Privacy mode": "Modo de privacidad",
    "Privacy mode off. Your balance is visible in the locked view.":
      "Modo de privacidad desactivado. Tu saldo es visible en la vista bloqueada.",
    "Privacy mode on. Your balance is hidden until you unlock this wallet.":
      "Modo de privacidad activado. Tu saldo estará oculto hasta que desbloquees esta billetera.",
    "Privacy on": "Privacidad activada",
    "Re-estimate Fee": "Re-estimar comisión",
    "Remove from this device": "Quitar de este dispositivo",
    "Restore a Spark wallet": "Restaurar una billetera Spark",
    "Restore a wallet": "Restaurar una billetera",
    "Restore this wallet": "Restaurar esta billetera",
    "Required sats (spend + 10,000-sat bond) exceed your available balance of {available} sats.":
      "Los sats requeridos (gasto + depósito de garantía de 10.000 sats) superan tu saldo disponible de {available} sats.",
    "Restoring...": "Restaurando...",
    Reusable: "Reutilizable",
    "Self-custody": "Autocustodia",
    "Self-custody wallet": "Billetera de autocustodia",
    "Send {amount} sats": "Enviar {amount} sats",
    "Send to a Spark wallet — 0 fee, instant.":
      "Enviar a una billetera Spark: sin comisión, al instante.",
    "Single-use": "De un solo uso",
    Spark: "Spark",
    "Spark fee (0.25% + routing)": "Comisión Spark (0,25 % + enrutamiento)",
    "Spark transfer": "Transferencia Spark",
    Taproot: "Taproot",
    "That doesn't look like a valid backup phrase. Check each word.":
      "Eso no parece una frase de respaldo válida. Revisa cada palabra.",
    "That's not the word at position {position}. Try again.":
      "Esa no es la palabra en la posición {position}. Inténtalo de nuevo.",
    "The estimated fee exceeds your cap. Payment will be rejected above this cap.":
      "La comisión estimada supera tu límite. El pago se rechazará por encima de este límite.",
    "This fee quote has expired. Go back and re-estimate the fee.":
      "Esta cotización de comisión ha vencido. Vuelve atrás y vuelve a estimar la comisión.",
    "This fee quote has expired. Re-estimate to get fresh fees.":
      "Esta cotización de comisión ha vencido. Vuelve a estimarla para obtener comisiones actualizadas.",
    "This is the wallet you're restoring:":
      "Esta es la billetera que vas a restaurar:",
    "This wallet hides its balance from third parties. Enter your backup phrase to unlock it.":
      "Esta billetera oculta su saldo a terceros. Ingresa tu frase de respaldo para desbloquearla.",
    "This wallet is yours alone.": "Esta billetera es solo tuya.",
    "Total (amount + fee + 10,000-sat bond) exceeds your available balance of {available} sats.":
      "El total (monto + comisión + depósito de garantía de 10.000 sats) supera tu saldo disponible de {available} sats.",
    "Type {address} to confirm.": "Escribe {address} para confirmar.",
    "Unlock Spark wallet": "Desbloquear billetera Spark",
    "Unlock wallet": "Desbloquear billetera",
    "Unlock your wallet to generate a deposit address.":
      "Desbloquea tu billetera para generar una dirección de depósito.",
    "Unlock your wallet to generate an invoice.":
      "Desbloquea tu billetera para generar una factura.",
    "Verify backup phrase": "Verificar frase de respaldo",
    "Wallet locked. The mnemonic was cleared from memory.":
      "Billetera bloqueada. La frase mnemotécnica se eliminó de la memoria.",
    "Wallet restored.": "Billetera restaurada.",
    "Wallet spends {amount} sats + a 10,000-sat bond (returned on settle). Recipient receives amount minus fee.":
      "La billetera gasta {amount} sats + un depósito de garantía de 10.000 sats (devuelto al liquidar). El destinatario recibe el monto menos la comisión.",
    "Wallet spends {total} sats (amount + fee) + a 10,000-sat bond (returned on settle). Recipient receives the full amount.":
      "La billetera gasta {total} sats (monto + comisión) + un depósito de garantía de 10.000 sats (devuelto al liquidar). El destinatario recibe el monto completo.",
    "Wallet type": "Tipo de billetera",
    "When locked, your balance stays readable on this device. Turning privacy on hides it until you unlock.":
      "Mientras está bloqueada, tu saldo sigue siendo legible en este dispositivo. Al activar la privacidad, se oculta hasta que desbloquees.",
    Withdrawal: "Retiro",
    "Withdrawal speed": "Velocidad del retiro",
    Word: "Palabra",
    "Write down your backup phrase in order. Keep it offline.":
      "Escribe tu frase de respaldo en orden. Mantenla fuera de línea.",
    "You hold your keys. Aratiri can't recover them.":
      "Tus claves están en tus manos. Aratiri no puede recuperarlas.",
    "You pay the network fee on the sending side.":
      "Pagas la comisión de red del lado del envío.",
    "Your 12-word backup phrase is the only way to access it. If you lose it, no one — not even Aratiri — can help you recover it.":
      "Tu frase de respaldo de 12 palabras es la única forma de acceder. Si la pierdes, nadie, ni siquiera Aratiri, podrá ayudarte a recuperarla.",
    "Your Spark wallet is ready. Here is your address:":
      "Tu billetera Spark está lista. Esta es tu dirección:",
    "Your backup is verified.": "Tu respaldo está verificado.",
    "Your balance isn't visible to third parties or in the locked view. It shows only after you unlock this wallet.":
      "Tu saldo no es visible para terceros ni en la vista bloqueada. Solo se muestra después de desbloquear esta billetera.",
    "Your device clock looks wrong. Check that the time and timezone are correct, then try again.":
      "El reloj de tu dispositivo parece incorrecto. Verifica que la hora y la zona horaria sean correctas e inténtalo de nuevo.",
    "≈ days": "≈ días",
    "≈ hours": "≈ horas",
    "≈ minutes": "≈ minutos",
    "≈ {fee} sats": "≈ {fee} sats",
  },
};
