# Bella Cristal · Análisis de costos

Herramienta web (funciona en celular y computador) que aplica el modelo costo-volumen-utilidad al emprendimiento Bella Cristal, como solución del planteamiento del problema del proyecto de Práctica Profesional I (Contaduría Pública, Uniminuto).

Página publicada: https://yimeroliverosmuneton-wq.github.io/bellacristalshop/

Tienda para clientas (sin cuenta): https://yimeroliverosmuneton-wq.github.io/bellacristalshop/tienda.html

Editor de automatizaciones tipo n8n, hecho en React: https://yimeroliverosmuneton-wq.github.io/bellacristalshop/flujos/ (ver [n8n-react/README.md](n8n-react/README.md)).

Cada persona crea su cuenta e inicia sesión; la información queda guardada en su cuenta. Para guardar las cuentas en la nube y entrar desde cualquier dispositivo, siga [FIREBASE.md](FIREBASE.md).

## Qué calcula
- Costo unitario de cada pijama (costos directos) y costo total unitario (con los costos y gastos fijos asignados).
- Costos indirectos y gastos operativos clasificados (administración, ventas, financieros) y separación de gastos personales.
- Margen de contribución unitario y porcentual por producto y por canal (detal / por mayor).
- Punto de equilibrio en unidades y en pesos, margen de seguridad.
- Estado de resultados por costeo variable, utilidad operacional y margen de utilidad.
- Estructura de precios y precio sugerido según margen objetivo.
- Relación entre volumen de ventas y rentabilidad, simulador de escenarios y unidades para una meta de utilidad.
- Indicadores de marketing digital (interacción, conversión, CAC, ROAS) ligados al margen.
- **Catálogo**: carga un PDF de catálogo mayorista (una prenda por página), lee nombre, tallas y precio mayorista, y permite poner al lado el precio de venta con su ganancia y margen. Trae precargada la nueva colección (67 prendas).
- **Factura de venta**: arma la factura con prendas del catálogo, datos de la clienta, descuento, envío e IVA opcional; genera la imagen de la factura, el texto para WhatsApp y un registro de ventas con ganancia bruta.
- **Tienda en línea** (`tienda.html`): catálogo público con precios al detal, promociones, descripción, tallas y carrito. Al agregar la primera prenda la clienta deja nombre y WhatsApp (con autorización de datos, Ley 1581 de 2012) y el carrito aparece al instante en la pestaña **Tienda** de la administración, donde se puede escribirle por WhatsApp o pasar el pedido a factura.
- Contraste automático de la hipótesis y lista de acciones propuestas, más un resumen de texto para pegar en el informe.

Las cifras iniciales son de ejemplo y deben reemplazarse con los registros reales.
