export type RenderListOptions<T, E extends Element = Element> = {
    data:readonly T[];
    key:(item:T, index:number) => string | number;
    update:(el:E, item:T) => void;
}

export type RenderOptions<T, E extends Element = Element> = {
    data?:T;
    update?:(el:E, item:T) => void;
}

const elementData = new WeakMap<Element, unknown>()
const elementKeys = new WeakMap<Element, string | number>()

export function renderList<T, E extends Element = Element> (
    container:Element,
    template:HTMLTemplateElement,
    options:RenderListOptions<T, E>
):void {
    const { data, key: getKey, update } = options
    const existingByKey = new Map<string | number, E>()

    for (const child of Array.from(container.children)) {
        const key = elementKeys.get(child)
        if (key !== undefined) existingByKey.set(key, child as E)
    }

    const dataKeys = new Set(data.map(getKey))

    for (const child of Array.from(container.children)) {
        const key = elementKeys.get(child)
        if (key === undefined || !dataKeys.has(key)) {
            child.remove()
            elementKeys.delete(child)
            elementData.delete(child)
        }
    }

    let prev:E | null = null
    for (let i = 0; i < data.length; i++) {
        const item = data[i]
        const key = getKey(item, i)
        let el = existingByKey.get(key)

        if (!el) {
            el = (template.content.cloneNode(true) as Element)
                .firstElementChild as E
            elementKeys.set(el, key)
        }

        if (elementData.get(el) !== item) {
            update(el, item)
            elementData.set(el, item)
        }

        const expected = prev ?
            prev.nextElementSibling :
            container.firstElementChild

        if (el !== expected) {
            if (prev) prev.after(el)
            else container.prepend(el)
        }

        prev = el
    }
}

let _tplCounter = 0
const tplIds = new WeakMap<HTMLTemplateElement, number>()

export function render<T, E extends Element = Element> (
    container:Element,
    template:HTMLTemplateElement,
    options?:RenderOptions<T, E>
):void {
    renderList<T, E>(container, template, {
        data: [
            options !== undefined && 'data' in options ?
                options.data as T :
                {} as T
        ],
        key: () => {
            let id = tplIds.get(template)
            if (id === undefined) {
                id = _tplCounter++
                tplIds.set(template, id)
            }
            return id
        },
        update: options?.update ?? (() => {}),
    })
}
