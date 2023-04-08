interface ICreateElementParams {
    classes?: string[];
    content?: string | HTMLElement | (HTMLElement | null)[] | null;
    parent?: HTMLElement | SVGElement;
    style?: { [K in keyof CSSStyleDeclaration]?: CSSStyleDeclaration[K] };
    attributes?: { [key: string]: string };
}

export function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, params: ICreateElementParams = {}): HTMLElementTagNameMap[K] {
    ;
    return buildElement(document.createElement(tag), params) as HTMLElementTagNameMap[K];
}

export function createSVGElement<K extends keyof SVGElementTagNameMap>(tag: K, params: ICreateElementParams = {}): SVGElementTagNameMap[K] {
    ;
    return buildElement(document.createElementNS('http://www.w3.org/2000/svg', tag), params) as SVGElementTagNameMap[K];
}

function buildElement(element: HTMLElement | SVGElement, { classes, content, parent, style, attributes }: ICreateElementParams = {}): HTMLElement | SVGElement {
    if (classes !== undefined)
        classes.forEach((el) => element.classList.add(el));

    if (content !== undefined) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (Array.isArray(content)) {
            (content.filter((el) => el !== null) as HTMLElement[]).forEach((el) => element.appendChild(el));
        } else if (content !== null) {
            element.appendChild(content);
        }
    }

    if (parent !== undefined)
        parent.appendChild(element);

    if (style !== undefined)
        Object.assign(element.style, style);

    if (attributes !== undefined) {
        for (const attribute in attributes)
            element.setAttribute(attribute, attributes[attribute]);
    }

    return element;
}
