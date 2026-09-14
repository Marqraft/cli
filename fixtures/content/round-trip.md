## Ünïcödé — “quotes” & <angle> text

Paragraph with **bold**, *italic*, `code with <tags>`, and a [link](/tutorial/).

![A photo](/images/photo.png)

<marqraft-code language="kex" filename="a &quot;quoted&quot; &lt;name&gt;.kex">
let html = "<p>&amp;amp;</p>"
  indented   line
</marqraft-code>

<marqraft-tabs>
<marqraft-area id="one" label="Première">
### Nested heading

<marqraft-code language="text">1 &lt; 2</marqraft-code>
</marqraft-area>
<marqraft-area id="two" label="日本語">
- item one
- item two
</marqraft-area>
</marqraft-tabs>

- first
- second

```kex
let doubled = xs.map { |x| x * 2 }
IO.printLine("${doubled}")
```

> [!WARNING]
> Check **this** first.
>
> - then this

> A plain quote stays a quote.

| Column | Other |
| --- | --- |
| a | b |

<unknown-widget data-x="1">kept <b>verbatim</b></unknown-widget>

<marqraft-tabs><marqraft-area id="broken" label="x">unclosed</marqraft-tabs>
