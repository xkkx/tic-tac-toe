import './styles/board.css';

import * as d3 from 'd3';
import { Timeline, cacheToCacheAsTree } from './lib/timeline';
import { CellState, transformations } from './transformations';
import { createElement, createSVGElement } from './lib/utils';
import { createPath } from './lib/svg-path';
import { Icons } from './lib/icons';

const MAX_ZOOM = 3;
const MIN_ZOOM = 0.2;
const ZOOM_SENSITIVITY = 100;

const ANIMATION_DURATION = 250;
const ANIMATION_EASING = '0.5, 0, 0.5, 1';

type BoardTree = ReturnType<typeof cacheToCacheAsTree<typeof transformations>>;
type Board = [HTMLDivElement, HTMLDivElement, HTMLDivElement[]];

export type Player = CellState.X | CellState.O;

enum Move {
    Impossible,
    Branch,
    Edit
}

const moveTextDisplay = document.getElementById('moveText')!;
const currentPlayerDispaly = document.getElementById('currentPlayer')!;

export class BoardDisplay {
    private container: HTMLDivElement;
    private boardContainer: HTMLDivElement;
    private linkContainer: SVGSVGElement;

    private timeline: Timeline<typeof transformations>;
    private onUpdate: (player: Player) => void;

    private boards: Map<string, Board> = new Map();
    private links: Map<string, SVGPathElement> = new Map();

    private dragging: boolean = false;
    private x: number = 0;
    private y: number = 0;
    private k: number = 1;

    constructor(container: HTMLElement, timeline: Timeline<typeof transformations>, onUpdate: (player: Player) => void) {
        this.timeline = timeline;
        this.onUpdate = onUpdate;

        this.container = createElement('div', {
            parent: container,
            classes: ['tic-tac-toe-container']
        });

        this.boardContainer = createElement('div', {
            parent: this.container,
            classes: ['board-container']
        });

        this.linkContainer = createSVGElement('svg', {
            parent: this.boardContainer,
            classes: ['link-container']
        });

        const translate = (dx: number, dy: number, dk: number) => {
            requestAnimationFrame(() => {
                if (this.k + dk > MAX_ZOOM) {
                    const new_dk = MAX_ZOOM - this.k;
                    dx = dx / dk * new_dk;
                    dy = dy / dk * new_dk;
                    dk = new_dk;
                } else if (this.k + dk < MIN_ZOOM) {
                    const new_dk = MIN_ZOOM - this.k;
                    dx = dx / dk * new_dk;
                    dy = dy / dk * new_dk;
                    dk = new_dk;
                }

                this.boardContainer.style.transform = `translate(${this.x += dx}px, ${this.y += dy}px) scale(${this.k += dk})`;
            });
        };

        this.container.onpointerdown = () => {
            this.dragging = true;
        };

        this.container.onpointermove = (event) => {
            if (!this.dragging)
                return;

            translate(event.movementX, event.movementY, 0);
        };

        this.container.onpointerup = () => this.dragging = false;
        this.container.onpointerleave = () => this.dragging = false;

        this.container.onwheel = (event) => {
            event.preventDefault();

            let delta = -event.deltaY / ZOOM_SENSITIVITY;

            if (!event.ctrlKey)
                delta = delta / 10;

            const rect = this.container.getBoundingClientRect();
            const position = [(event.x - rect.left - this.x) / this.k, (event.y - rect.top - this.y) / this.k];

            translate(-position[0] * delta, -position[1] * delta, delta);
        };

        this.update(CellState.X);
    }

    public setSize(width: number, height: number) {
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;
        this.resetTranslation();
    }

    public update(player: Player) {
        moveTextDisplay.textContent = 'Current move:\xa0';
        currentPlayerDispaly.textContent = player;

        const tree = cacheToCacheAsTree(this.timeline.getStates(), this.timeline.getCache());
        const root = d3.tree<BoardTree>().nodeSize([200, 200])(d3.hierarchy<BoardTree>(tree));

        root.descendants().forEach((node) => {
            const boardId = node.data.id;
            const boardData = node.data.data;
            const move = player === CellState.O && boardData.moveCharacter === CellState.Empty ? Move.Impossible : (player !== boardData.moveCharacter ? Move.Branch : Move.Edit);

            const [board, boardText, cells] = this.getBoardOrDefault(boardId);

            const nextPlayer = player === CellState.X ? CellState.O : CellState.X;

            if (move === Move.Branch) {
                boardText.textContent = node.children === undefined ? `${Icons.Plus}\xa0\xa0New move` : `${Icons.Branch}\xa0\xa0Branch`;
            } else if (move === Move.Edit) {
                boardText.textContent = `${Icons.Pencil}\xa0\xa0Edit`;
            } else {
                boardText.textContent = `${Icons.Cross}\xa0\xa0Impossible`;
            }

            if (board.style.transform === '' && node.parent !== null)
                board.style.transform = `translate(${node.parent.y}px, ${node.parent.x}px)`;

            let clickBlocked = true;

            board.animate([
                { transform: `translate(${node.y}px, ${node.x}px)` }
            ], {
                duration: ANIMATION_DURATION,
                easing: `cubic-bezier(${ANIMATION_EASING})`,
                fill: 'forwards'
            }).onfinish = () => {
                board.style.transform = `translate(${node.y}px, ${node.x}px)`;
                clickBlocked = false;
            };

            cells.forEach((cell, idx) => {
                cell.textContent = boardData.board[idx];
                cell.classList.remove(...cell.classList);
                cell.classList.add('cell');

                if (idx === boardData.moveIndex && boardData.moveCharacter !== CellState.Empty) {
                    cell.classList.add('cell-last-move');
                } else {
                    cell.classList.remove('cell-last-move');
                }

                let clickAction = Move.Impossible;
                let skipClick = false;

                cell.onmousemove = () => {
                    if (this.dragging)
                        skipClick = true;
                }

                cell.onpointerenter = () => {
                    if (boardData.board[idx] === CellState.Empty && move !== Move.Impossible) {
                        cell.textContent = player;
                        cell.classList.add('cell-valid-move');
                    } else {
                        cell.classList.add('cell-invalid-move');
                        return;
                    }

                    if (move === Move.Branch) {
                        clickAction = Move.Branch;
                    } else {
                        this.forEachDescendant(node.data, (board) => {
                            const cell = this.getBoardOrDefault(board.id)[2][boardData.moveIndex];
                            cell.classList.add('cell-removed-move');
                        });

                        let isValid = true;

                        this.forEachDescendant(node.data, (node) => {
                            if (node.data.board[idx] !== CellState.Empty)
                                isValid = false;
                        });

                        this.forEachDescendant(node.data, (node) => {
                            const cell = this.getBoardOrDefault(node.id)[2][idx];
                            cell.classList.add(isValid ? 'cell-valid-move' : 'cell-invalid-move');
                            cell.textContent = node.data.board[idx] === CellState.Empty ? player : '?';
                        });

                        if (isValid)
                            clickAction = Move.Edit;
                    }
                };

                cell.onpointerleave = () => {
                    if (boardData.board[idx] === CellState.Empty && move !== Move.Impossible) {
                        cell.textContent = boardData.board[idx];
                        cell.classList.remove('cell-valid-move');
                    } else {
                        cell.classList.remove('cell-invalid-move');
                        return;
                    }

                    if (move === Move.Edit) {
                        this.forEachDescendant(node.data, (board) => {
                            const cell = this.getBoardOrDefault(board.id)[2][boardData.moveIndex];
                            cell.classList.remove('cell-removed-move');
                        });

                        this.forEachDescendant(node.data, (node) => {
                            const cell = this.getBoardOrDefault(node.id)[2][idx];
                            cell.classList.remove('cell-valid-move');
                            cell.classList.remove('cell-invalid-move');
                            cell.textContent = node.data.board[idx];
                        });
                    }
                };

                cell.onclick = async () => {
                    if (clickBlocked)
                        return;

                    if (skipClick) {
                        skipClick = false;
                        return;
                    }

                    if (clickAction === Move.Branch) {
                        (await this.timeline.branch(boardId, 'move', idx, player)).apply();
                    } else if (clickAction === Move.Edit) {
                        (await this.timeline.edit(boardId, 'move', idx, player)).apply();
                    }

                    if (clickAction !== Move.Impossible) {
                        this.update(nextPlayer);
                        this.onUpdate(nextPlayer);
                    }

                    if (cell.onpointerenter !== null)
                        cell.onpointerenter(null as unknown as PointerEvent);

                    clickAction = Move.Impossible;
                };
            });
        });

        root.links().forEach((link) => {
            const line = this.getLinkOrDefault(link.source.data.id, link.target.data.id);

            const source = this.getBoardOrDefault(link.source.data.id)[0].getBoundingClientRect();
            const target = this.getBoardOrDefault(link.target.data.id)[0].getBoundingClientRect();

            const x1 = link.source.y + source.width / this.k;
            const y1 = link.source.x + source.height / (2 * this.k);
            const x2 = link.target.y;
            const y2 = link.target.x + target.height / (2 * this.k);

            const start = line.getAttribute('d') ?? createPath(x1, y1, x1, y1);
            const end = createPath(x1, y1, x2, y2);

            const anim = createSVGElement('animate', {
                parent: line,
                attributes: {
                    attributeName: 'd',
                    dur: `${ANIMATION_DURATION}ms`,
                    from: start,
                    to: end,
                    calcMode: 'spline',
                    keySplines: ANIMATION_EASING.replaceAll(',', ''),
                    keyTimes: '0; 1',
                    fill: 'freeze'
                }
            });

            anim.beginElement();

            setTimeout(() => {
                line.setAttribute('d', end);
                anim.remove();
            }, ANIMATION_DURATION);
        });
    }

    public resetTranslation() {
        const boardContainerHeight = this.container.getBoundingClientRect().height;
        const boardHeight = document.querySelector('.board')!.getBoundingClientRect().height;

        this.x = 30;
        this.y = boardContainerHeight / 2 - boardHeight / this.k / 2;
        this.k = 1;

        requestAnimationFrame(() => {
            this.boardContainer.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.k})`;
        });
    }

    public gameOver(winner: CellState) {
        this.boards.forEach((board) => {
            board[2].forEach((cell) => {
                cell.onmousemove = null;
                cell.onpointerenter = null;
                cell.onpointerleave = null;
                cell.onclick = null;
            });
        });

        moveTextDisplay.textContent = 'Game over:\xa0';
        currentPlayerDispaly.textContent = winner === CellState.Empty ? 'Tie' : `${winner} won`;
    }

    private getBoardOrDefault(id: string): Board {
        if (!this.boards.has(id)) {
            const board = createElement('div', {
                classes: ['board']
            });

            this.boardContainer.insertBefore(board, this.boardContainer.firstChild);

            const boardText = createElement('div', {
                parent: board,
                classes: ['board-text'],
            });

            const cellContainer = createElement('div',  {
                parent: board,
                classes: ['cell-container']
            });

            const cells = Array.from({ length: 9 }, () => createElement('div', {
                parent: cellContainer
            }));

            this.boards.set(id, [board, boardText, cells]);
        }

        return this.boards.get(id)!;
    }

    private getLinkOrDefault(source: string, target: string): SVGPathElement {
        const id = `${source}-${target}`;

        if (!this.links.has(id)) {
            const link = createSVGElement('path', {
                parent: this.linkContainer
            });

            this.links.set(id, link);
        }

        return this.links.get(id)!;
    }

    private forEachDescendant(node: BoardTree, callback: (node: BoardTree) => void) {
        const queue = [node];

        for (const node of queue) {
            queue.push(...node.children);
            callback(node);
        }
    }
}
