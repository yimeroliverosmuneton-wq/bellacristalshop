# Flujos · n8n hecho en React

Editor visual de automatizaciones inspirado en [n8n](https://n8n.io), escrito en React y que corre por completo en el navegador (sin servidor).

Publicado en: https://yimeroliverosmuneton-wq.github.io/bellacristalshop/flujos/

## Qué hace
- **Lienzo** con cuadrícula, zoom (rueda o botones), desplazamiento, selección múltiple (Shift + clic) y nodos que se arrastran.
- **Conexiones**: arrastre desde la salida de un nodo hasta la entrada de otro, o pulse el **+** de una salida libre para agregar el siguiente paso ya conectado.
- **Nodos**: Disparador manual, Programado, Datos fijos, Petición HTTP, Editar campos, Código (JavaScript), Dividir en elementos, Ordenar, Limitar, Resumir, Si (IF), Filtrar, Unir, Esperar y Sin operación.
- **Panel del nodo** (doble clic) con Entrada | Parámetros | Salida, vista en tabla o JSON y botón «Probar paso».
- **Expresiones** como en n8n: `{{ $json.campo }}`, `{{ $('Otro nodo').first().json.total }}`, `{{ $now }}`, con vista previa del resultado. Las columnas de la tabla de entrada se pueden arrastrar a un parámetro.
- **Ejecución** por elementos (`[{ json }]`), con conteo de elementos en cada conexión y marca de éxito o error en cada nodo.
- **Varios flujos**, guardado automático en el navegador, importar y exportar JSON, historial de ejecuciones y flujo **activo** para el disparador programado (mientras la pestaña esté abierta).

Atajos: `Tab` agregar nodo · `Supr` borrar · `Ctrl+Z` deshacer · `Ctrl+C` / `Ctrl+V` copiar y pegar · `Ctrl+D` duplicar · `Ctrl+Enter` ejecutar · `Enter` abrir nodo · `Shift+1` ajustar vista.

## Desarrollo
```bash
cd n8n-react
npm install
npm run dev      # servidor local
npm run build    # compila en ../flujos (lo que publica GitHub Pages)
```

Código: `src/nodes.js` (tipos de nodo), `src/engine.js` (motor de ejecución), `src/expr.js` (expresiones), `src/Canvas.jsx` (lienzo), `src/NodeDetails.jsx` (panel del nodo), `src/App.jsx` (estado, flujos, atajos).
