import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatRadioModule } from "@angular/material/radio";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSliderModule } from "@angular/material/slider";
import { MatChipsModule } from "@angular/material/chips";
import { MatTabsModule } from "@angular/material/tabs";
import { MatCardModule } from "@angular/material/card";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatListModule } from "@angular/material/list";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatTableModule } from "@angular/material/table";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatBadgeModule } from "@angular/material/badge";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatAutocompleteModule } from "@angular/material/autocomplete";

@Component({
  selector: "app-styleguide-dialog",
  imports: [MatDialogModule, MatButtonModule],
  template: `<h2 mat-dialog-title>Dialog title</h2>
    <mat-dialog-content>Some dialog content goes here.</mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" mat-dialog-close>OK</button>
    </mat-dialog-actions>`,
})
export class StyleguideDialogComponent {}

@Component({
  selector: "app-styleguide",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatChipsModule,
    MatTabsModule,
    MatCardModule,
    MatExpansionModule,
    MatListModule,
    MatMenuModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatBadgeModule,
    MatPaginatorModule,
    MatAutocompleteModule,
  ],
  template: `
    <div class="p-6 flex flex-col gap-6" id="styleguide">
      <section class="flex flex-wrap items-center gap-3">
        <button mat-button>Text</button>
        <button mat-flat-button color="primary">Flat</button>
        <button mat-raised-button color="primary">Raised</button>
        <button mat-stroked-button color="primary">Stroked</button>
        <button mat-flat-button color="accent">Accent</button>
        <button mat-flat-button color="warn">Warn</button>
        <button mat-flat-button disabled>Disabled</button>
        <button mat-icon-button color="primary">
          <mat-icon svgIcon="mat:favorite" />
        </button>
        <button mat-fab color="primary"><mat-icon svgIcon="mat:add" /></button>
        <button mat-mini-fab color="primary">
          <mat-icon svgIcon="mat:add" />
        </button>
        <button mat-flat-button id="open-dialog" (click)="openDialog()">
          Dialog
        </button>
        <button mat-flat-button id="open-snack" (click)="openSnack()">
          Snack
        </button>
        <button mat-flat-button id="open-menu" [matMenuTriggerFor]="menu">
          Menu
        </button>
        <mat-menu #menu="matMenu">
          <button mat-menu-item>
            <mat-icon svgIcon="mat:person" />Profile
          </button>
          <button mat-menu-item>Settings</button>
        </mat-menu>
        <mat-button-toggle-group value="a"
          ><mat-button-toggle value="a">A</mat-button-toggle
          ><mat-button-toggle value="b"
            >B</mat-button-toggle
          ></mat-button-toggle-group
        >
      </section>

      <section class="grid grid-cols-3 gap-4">
        <mat-form-field
          ><mat-label>Input</mat-label><input matInput value="Hello"
        /></mat-form-field>
        <mat-form-field
          ><mat-label>Select</mat-label>
          <mat-select id="select" value="1"
            ><mat-option value="1">One</mat-option
            ><mat-option value="2">Two</mat-option></mat-select
          >
        </mat-form-field>
        <mat-form-field
          ><mat-label>Date</mat-label
          ><input matInput [matDatepicker]="dp" /><mat-datepicker-toggle
            matSuffix
            [for]="dp" /><mat-datepicker #dp
        /></mat-form-field>
        <mat-form-field
          ><mat-label>Autocomplete</mat-label
          ><input matInput [matAutocomplete]="auto" /><mat-autocomplete
            #auto="matAutocomplete"
            ><mat-option value="x">Xavier</mat-option></mat-autocomplete
          ></mat-form-field
        >
        <mat-form-field
          ><mat-label>Error</mat-label><input matInput value="bad" /><mat-hint
            >Hint text</mat-hint
          ></mat-form-field
        >
        <mat-form-field
          ><mat-label>Textarea</mat-label
          ><textarea matInput rows="2">Text</textarea>
        </mat-form-field>
      </section>

      <section class="flex flex-wrap items-center gap-6">
        <mat-checkbox checked>Checked</mat-checkbox>
        <mat-checkbox>Unchecked</mat-checkbox>
        <mat-radio-group value="1"
          ><mat-radio-button value="1">R1</mat-radio-button
          ><mat-radio-button value="2">R2</mat-radio-button></mat-radio-group
        >
        <mat-slide-toggle checked>Toggle</mat-slide-toggle>
        <mat-slider min="0" max="100"
          ><input matSliderThumb value="40"
        /></mat-slider>
        <mat-chip-set
          ><mat-chip>Chip</mat-chip
          ><mat-chip highlighted>Selected</mat-chip></mat-chip-set
        >
        <mat-icon matBadge="4" svgIcon="mat:notifications" />
        <mat-spinner diameter="32" mode="determinate" value="60" />
      </section>

      <mat-progress-bar mode="determinate" value="55" />

      <section class="grid grid-cols-2 gap-4">
        <mat-card
          ><mat-card-header
            ><mat-card-title>Card</mat-card-title></mat-card-header
          ><mat-card-content>Card content</mat-card-content></mat-card
        >
        <mat-accordion>
          <mat-expansion-panel expanded
            ><mat-expansion-panel-header>Panel</mat-expansion-panel-header
            >Body</mat-expansion-panel
          >
        </mat-accordion>
      </section>

      <mat-tab-group>
        <mat-tab label="One">First tab</mat-tab>
        <mat-tab label="Two">Second tab</mat-tab>
      </mat-tab-group>

      <mat-list
        ><mat-list-item>Item one</mat-list-item
        ><mat-list-item>Item two</mat-list-item></mat-list
      >

      <table mat-table [dataSource]="rows" class="w-full">
        <ng-container matColumnDef="name"
          ><th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let r">{{ r.name }}</td></ng-container
        >
        <ng-container matColumnDef="qty"
          ><th mat-header-cell *matHeaderCellDef>Qty</th>
          <td mat-cell *matCellDef="let r">{{ r.qty }}</td></ng-container
        >
        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols"></tr>
      </table>
      <mat-paginator [length]="50" [pageSize]="10" />
    </div>
  `,
})
export class StyleguideComponent {
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  cols = ["name", "qty"];
  rows = [
    { name: "Apples", qty: 3 },
    { name: "Pears", qty: 5 },
  ];
  openDialog() {
    this.dialog.open(StyleguideDialogComponent);
  }
  openSnack() {
    this.snack.open("Snack message", "Undo");
  }
}
